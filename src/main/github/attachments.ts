import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BrowserWindow, session } from "electron";
import type {
  AttachmentAuthStatus,
  AttachmentFile,
  AttachmentUpload,
} from "../../shared/types";

// Attachments are the one thing GitHub has no API for: /upload/policies/assets
// answers 422 to a personal access token because it wants a user_session
// cookie. So the app keeps its own logged-in github.com session in a separate
// window partition and lets GitHub's own page do the upload — we hand a file to
// the composer's file input over the DevTools protocol (the same mechanism
// browser automation uses) and read the asset URL back out of the textarea.
// Driving the page rather than calling the internal endpoint ourselves means
// GitHub can change the upload protocol without breaking us.
const partition = "persist:github-web";

const assetUrlPattern =
  /https:\/\/github\.com\/user-attachments\/assets\/[\w-]+/;

const uploadTimeoutMs = 120_000;
const pollIntervalMs = 500;

function githubSession() {
  return session.fromPartition(partition);
}

async function readCookie(name: string): Promise<string | null> {
  const cookies = await githubSession().cookies.get({
    domain: "github.com",
    name,
  });
  return cookies[0]?.value ?? null;
}

export async function getAttachmentAuthStatus(): Promise<AttachmentAuthStatus> {
  const [userSession, login] = await Promise.all([
    readCookie("user_session"),
    readCookie("dotcom_user"),
  ]);
  return { signedIn: Boolean(userSession), login };
}

const signInTimeoutMs = 10 * 60 * 1000;

// Opens a real GitHub sign-in window and resolves once the session cookie
// lands, the user closes the window, or the wait runs out. Every path settles:
// the renderer keeps a button spinning until this returns.
export async function signInForAttachments(): Promise<AttachmentAuthStatus> {
  const before = await getAttachmentAuthStatus();
  if (before.signedIn) return before;

  const window = new BrowserWindow({
    width: 980,
    height: 800,
    title: "Sign in to GitHub",
    autoHideMenuBar: true,
    webPreferences: { partition },
  });

  const noSession: AttachmentAuthStatus = { signedIn: false, login: null };

  try {
    return await new Promise<AttachmentAuthStatus>((resolve) => {
      let done = false;
      let poll: ReturnType<typeof setInterval> | undefined;
      let timeout: ReturnType<typeof setTimeout> | undefined;

      function settle(status: AttachmentAuthStatus) {
        if (done) return;
        done = true;
        clearInterval(poll);
        clearTimeout(timeout);
        resolve(status);
      }

      // The cookie can only be read out of band, so poll for it rather than
      // trying to recognise the page the user lands on after signing in.
      poll = setInterval(() => {
        void getAttachmentAuthStatus().then((status) => {
          if (status.signedIn) settle(status);
        }, noop);
      }, 1000);

      timeout = setTimeout(() => settle(noSession), signInTimeoutMs);

      // Closed without finishing — check once more in case the cookie landed
      // between polls, then give up rather than hang.
      window.on("closed", () => {
        void getAttachmentAuthStatus().then(settle, () => settle(noSession));
      });

      void window.loadURL("https://github.com/login").catch(() => {
        settle(noSession);
      });
    });
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
}

function noop(): void {}

export async function signOutOfAttachments(): Promise<AttachmentAuthStatus> {
  await githubSession().clearStorageData({ storages: ["cookies"] });
  return getAttachmentAuthStatus();
}

function kindOf(name: string): AttachmentUpload["kind"] {
  const extension = name.toLowerCase().split(".").pop() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) {
    return "image";
  }
  if (["mp4", "mov", "webm"].includes(extension)) return "video";
  return "file";
}

// A page with a comment composer on it. The PR's own page when we have one —
// for the new-PR dialog there's no PR yet, so fall back to the new-issue form
// (never submitted; the upload happens the moment the file is attached).
function composerUrl(repo: string, prNumber?: number): string {
  return prNumber
    ? `https://github.com/${repo}/pull/${prNumber}`
    : `https://github.com/${repo}/issues/new`;
}

// The composer is client-rendered, so its file input doesn't exist at load and
// isn't the first input[type=file] on the page — a PR page also carries
// Copilot's attachment input, which has its own narrower allowlist and is what
// we were feeding before. Pick the input in page script (where "the one that
// shares a container with the comment textarea" is easy to express), tag it,
// then address the tag over the DevTools protocol.
const markComposerInput = `(() => {
  for (const marked of document.querySelectorAll("[data-reviewr-upload]")) {
    marked.removeAttribute("data-reviewr-upload");
  }

  const isCopilot = (el) =>
    Boolean(el.closest('[data-testid*="copilot"], [class*="opilot"], [aria-label*="opilot"]'));

  const inputs = Array.from(
    document.querySelectorAll('input[type="file"]'),
  ).filter((el) => !isCopilot(el));

  const preferred = [
    'file-attachment input[type="file"]',
    '.js-upload-markdown-image input[type="file"]',
    "input.manual-file-chooser",
  ];

  let chosen = null;
  for (const selector of preferred) {
    chosen = inputs.find((el) => el.matches(selector)) ?? null;
    if (chosen) break;
  }
  // Otherwise the input that lives with a comment box is the composer's.
  chosen ??=
    inputs.find((el) => {
      const scope =
        el.closest('form, file-attachment, [data-testid*="markdown"]') ??
        document.body;
      return Boolean(scope.querySelector("textarea"));
    }) ?? null;

  if (!chosen) {
    return JSON.stringify({
      found: false,
      candidates: inputs.length,
    });
  }
  chosen.setAttribute("data-reviewr-upload", "1");
  return JSON.stringify({ found: true, candidates: inputs.length });
})()`;

const inputWaitMs = 20_000;

async function findFileInput(
  window: BrowserWindow,
): Promise<{ nodeId: number }> {
  const debug = window.webContents.debugger;
  const deadline = Date.now() + inputWaitMs;
  let candidates = 0;

  while (Date.now() < deadline) {
    const report = await window.webContents.executeJavaScript(
      markComposerInput,
      true,
    );
    const marked =
      typeof report === "string"
        ? (JSON.parse(report) as { found: boolean; candidates: number })
        : { found: false, candidates: 0 };
    candidates = marked.candidates;

    if (marked.found) {
      const { root } = await debug.sendCommand("DOM.getDocument", {
        depth: -1,
      });
      const { nodeId } = await debug.sendCommand("DOM.querySelector", {
        nodeId: root.nodeId,
        selector: '[data-reviewr-upload="1"]',
      });
      if (nodeId) return { nodeId };
    }

    await delay(pollIntervalMs);
  }

  throw new Error(
    `Couldn’t find GitHub’s comment upload field (${candidates} file field(s) on the page).`,
  );
}

// GitHub writes the markdown for the finished upload straight into whichever
// textarea the file was dropped on, so an asset URL appearing in the page's
// textareas is our completion signal. A PR page also carries hidden edit forms
// holding existing comment bodies, though, and those may already contain
// attachment URLs — so the URLs present before the upload are recorded and
// only a new one counts.
async function readAssetUrls(window: BrowserWindow): Promise<string[]> {
  const text = await window.webContents.executeJavaScript(
    `Array.from(document.querySelectorAll("textarea"))
      .map((area) => area.value)
      .join("\\n")`,
    true,
  );
  if (typeof text !== "string") return [];
  return [...text.matchAll(new RegExp(assetUrlPattern.source, "g"))].map(
    (match) => match[0],
  );
}

// GitHub ships the "we don't support that file type" wording — the whole
// allowlist — into the page hidden, ready to be shown. Scraping error text
// alone therefore reports a failure the moment the page loads, whatever the
// file is. Only an error that is actually on screen counts.
async function readUploadError(window: BrowserWindow): Promise<string | null> {
  const text = await window.webContents.executeJavaScript(
    `(() => {
      const onScreen = (el) => {
        if (!el || el.hidden || el.closest("template")) return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") {
          return false;
        }
        if (el.getAttribute("aria-hidden") === "true") return false;
        // Deliberately no geometry check: the upload window is never shown, so
        // getBoundingClientRect returns zeros for everything in it and would
        // hide real errors.
        return true;
      };

      // Widest sensible scope first: the error is often a sibling of the
      // upload widget, so closest("file-attachment") would look inside it and
      // miss the message entirely.
      const input = document.querySelector('[data-reviewr-upload="1"]');
      const scope =
        input?.closest('form') ??
        input?.closest('[data-testid*="markdown"]') ??
        input?.closest("file-attachment") ??
        document.body;

      const found = Array.from(
        scope.querySelectorAll(
          '.flash-error, [class*="errorMessage"], [data-target$="errorMessage"], [role="alert"]',
        ),
      ).find((el) => onScreen(el) && el.textContent.trim());

      return found ? found.textContent.trim().replace(/\\s+/g, " ") : "";
    })()`,
    true,
  );
  return typeof text === "string" && text ? text : null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Each upload drives a hidden window through a full GitHub page load, so
// dropping five files at once would open five of them. They queue instead.
let queue: Promise<unknown> = Promise.resolve();

export function uploadAttachment(
  repo: string,
  prNumber: number | null,
  file: AttachmentFile,
): Promise<AttachmentUpload> {
  const run = queue.then(
    () => performUpload(repo, prNumber, file),
    () => performUpload(repo, prNumber, file),
  );
  queue = run.catch(() => undefined);
  return run;
}

// A dropped file's name is only a name — keep it from reaching outside the
// temp directory.
function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  const cleaned = base.replace(/^\.+/, "").trim();
  return cleaned || "attachment";
}

async function performUpload(
  repo: string,
  prNumber: number | null,
  file: AttachmentFile,
): Promise<AttachmentUpload> {
  const status = await getAttachmentAuthStatus();
  if (!status.signedIn) {
    throw new Error(
      "Not signed in to GitHub for attachments. Connect a GitHub session in Settings → GitHub.",
    );
  }

  // The upload needs a real file on disk: a pasted screenshot arrives as bytes
  // with no path of its own.
  const directory = await mkdtemp(join(tmpdir(), "reviewr-upload-"));
  const filePath = join(directory, safeFileName(file.name));
  await writeFile(filePath, file.data);

  const window = new BrowserWindow({
    show: false,
    width: 1200,
    height: 900,
    // A hidden window has its timers and animation frames throttled, which can
    // stall GitHub's upload script mid-flight.
    webPreferences: { partition, backgroundThrottling: false },
  });

  try {
    await window.loadURL(composerUrl(repo, prNumber ?? undefined));
    window.webContents.debugger.attach("1.3");
    await window.webContents.debugger.sendCommand("DOM.enable");

    const input = await findFileInput(window);
    const before = new Set(await readAssetUrls(window));

    await window.webContents.debugger.sendCommand("DOM.setFileInputFiles", {
      files: [filePath],
      nodeId: input.nodeId,
    });

    const deadline = Date.now() + uploadTimeoutMs;
    while (Date.now() < deadline) {
      const url = (await readAssetUrls(window)).find((it) => !before.has(it));
      if (url) return { url, name: file.name, kind: kindOf(file.name) };

      const failure = await readUploadError(window);
      if (failure) throw new Error(failure);

      await delay(pollIntervalMs);
    }
    throw new Error("The upload timed out.");
  } finally {
    if (window.webContents.debugger.isAttached()) {
      window.webContents.debugger.detach();
    }
    if (!window.isDestroyed()) window.destroy();
    await rm(directory, { recursive: true, force: true });
  }
}
