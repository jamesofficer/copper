import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  FileStatus,
  LocalChanges,
  PullRequestFile,
} from "../../shared/types";

const run = promisify(execFile);

// git's well-known empty tree id — what a repo with no commits diffs against.
const emptyTree = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

const devNull = process.platform === "win32" ? "NUL" : "/dev/null";

// Above this a file's patch is dropped (counts kept) and the diff viewer
// shows its existing "too large to show" state — like GitHub, which omits
// the patch for huge files. Keeps a stray bundle or log from shipping
// megabytes over IPC into the renderer.
const maxPatchLength = 1024 * 1024;

async function git(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await run(
    "git",
    ["-C", repoPath, "-c", "core.quotepath=off", ...args],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  return stdout;
}

// git C-quotes a path containing quotes, backslashes, or control characters
// (core.quotepath=off only stops the escaping of non-ASCII).
function unquotePath(raw: string): string {
  if (raw.length < 2 || !raw.startsWith('"') || !raw.endsWith('"')) return raw;
  const escapes: Record<string, string> = {
    '"': '"',
    "\\": "\\",
    n: "\n",
    t: "\t",
    r: "\r",
  };
  return raw
    .slice(1, -1)
    .replace(/\\(\d{3}|.)/g, (_, seq: string) =>
      /^\d{3}$/.test(seq)
        ? String.fromCharCode(Number.parseInt(seq, 8))
        : (escapes[seq] ?? seq),
    );
}

function stripPathPrefix(path: string, prefix: "a/" | "b/"): string {
  return path.startsWith(prefix) ? path.slice(2) : path;
}

// Trims the trailing empty line a split leaves behind and counts +/- lines.
function finishBody(lines: string[]): {
  patch: string | null;
  additions: number;
  deletions: number;
} {
  const body = [...lines];
  while (body.length > 0 && body[body.length - 1] === "") body.pop();
  let additions = 0;
  let deletions = 0;
  for (const line of body) {
    if (line.startsWith("+")) additions++;
    else if (line.startsWith("-")) deletions++;
  }
  const patch = body.join("\n");
  return {
    patch: patch.length > maxPatchLength ? null : patch,
    additions,
    deletions,
  };
}

// One "diff --git" block (the header line's remainder at index 0) → a
// PullRequestFile shaped like GitHub's: `patch` holds the hunks only, and
// binary or header-only diffs get patch: null.
function parseFileBlock(block: string): PullRequestFile | null {
  const lines = block.split("\n");
  let status: FileStatus = "modified";
  let path: string | null = null;
  let previousPath: string | null = null;
  let bodyStart = -1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("@@")) {
      bodyStart = i;
      break;
    }
    if (line.startsWith("new file mode")) status = "added";
    else if (line.startsWith("deleted file mode")) status = "deleted";
    else if (line.startsWith("rename from ")) {
      status = "renamed";
      previousPath = unquotePath(line.slice("rename from ".length));
    } else if (line.startsWith("rename to ")) {
      path = unquotePath(line.slice("rename to ".length));
    } else if (line.startsWith("+++ ")) {
      // git appends a tab to unquoted ---/+++ paths containing spaces.
      const target = unquotePath(line.slice(4).replace(/\t$/, ""));
      if (target !== "/dev/null" && path === null) {
        path = stripPathPrefix(target, "b/");
      }
    } else if (line.startsWith("--- ")) {
      // Deleted files only name themselves on the old side.
      const source = unquotePath(line.slice(4).replace(/\t$/, ""));
      if (source !== "/dev/null" && path === null && status === "deleted") {
        path = stripPathPrefix(source, "a/");
      }
    }
  }

  if (path === null) {
    // Header-only diffs (binary, mode change) name the file only on the
    // "diff --git a/x b/y" line. Ambiguous for a path containing " b/" —
    // acceptable for this last-resort fallback.
    const header = lines[0];
    const quoted = header.lastIndexOf(' "b/');
    if (quoted !== -1) {
      path = stripPathPrefix(unquotePath(header.slice(quoted + 1)), "b/");
    } else {
      const plain = header.lastIndexOf(" b/");
      if (plain !== -1) path = header.slice(plain + 3);
    }
  }
  if (path === null || path === "") return null;

  if (bodyStart === -1) {
    return {
      path,
      previousPath,
      status,
      additions: 0,
      deletions: 0,
      patch: null,
    };
  }
  const { patch, additions, deletions } = finishBody(lines.slice(bodyStart));
  return { path, previousPath, status, additions, deletions, patch };
}

// Hunk body lines always start with " ", "+", "-", or "\", so a line starting
// "diff --git " can only be the next file's header.
export function parseGitDiff(output: string): PullRequestFile[] {
  const files: PullRequestFile[] = [];
  for (const block of output.split(/^diff --git /m).slice(1)) {
    const file = parseFileBlock(block);
    if (file) files.push(file);
  }
  return files;
}

// Staged + unstaged changes in one diff against HEAD.
async function trackedChanges(repoPath: string): Promise<PullRequestFile[]> {
  const diffArgs = ["-M", "--no-color", "--no-ext-diff"];
  let output: string;
  try {
    output = await git(repoPath, ["diff", "HEAD", ...diffArgs]);
  } catch {
    // A repo with no commits yet has no HEAD — diff against the empty tree
    // so staged files still show.
    output = await git(repoPath, ["diff", emptyTree, ...diffArgs]);
  }
  return parseGitDiff(output);
}

async function untrackedFile(
  repoPath: string,
  path: string,
): Promise<PullRequestFile> {
  const file: PullRequestFile = {
    path,
    previousPath: null,
    status: "added",
    additions: 0,
    deletions: 0,
    patch: null,
  };
  let output: string;
  try {
    // Exit 0 means no difference — an empty file.
    output = await git(repoPath, [
      "diff",
      "--no-color",
      "--no-ext-diff",
      "--no-index",
      "--",
      devNull,
      path,
    ]);
  } catch (error) {
    // --no-index exits 1 whenever the files differ — the normal case here.
    const stdout = (error as { stdout?: unknown }).stdout;
    if (typeof stdout !== "string" || stdout === "") return file;
    output = stdout;
  }
  const lines = output.split("\n");
  const bodyStart = lines.findIndex((line) => line.startsWith("@@"));
  // No hunks: binary, or the file couldn't be read.
  if (bodyStart === -1) return file;
  const { patch, additions } = finishBody(lines.slice(bodyStart));
  return { ...file, additions, patch };
}

async function untrackedChanges(repoPath: string): Promise<PullRequestFile[]> {
  const listed = await git(repoPath, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  ]);
  const queue = listed.split("\0").filter(Boolean);
  const files: PullRequestFile[] = [];
  // One git call per file; a small worker pool keeps a big untracked set from
  // spawning hundreds of processes at once. Order is restored by the sort in
  // getLocalChanges.
  async function worker(): Promise<void> {
    for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
      files.push(await untrackedFile(repoPath, path));
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));
  return files;
}

async function currentBranch(repoPath: string): Promise<string | null> {
  try {
    return (await git(repoPath, ["symbolic-ref", "--short", "HEAD"])).trim();
  } catch {
    return null;
  }
}

// Uncommitted work in a registered local checkout — staged + unstaged changes
// plus untracked files — shaped like a PR's changed files so the diff UI
// renders them unchanged.
export async function getLocalChanges(repoPath: string): Promise<LocalChanges> {
  const [branch, tracked, untracked] = await Promise.all([
    currentBranch(repoPath),
    trackedChanges(repoPath),
    untrackedChanges(repoPath),
  ]);
  // "git rm --cached" leaves a path both deleted-in-index and untracked;
  // keep the tracked entry so paths stay unique.
  const byPath = new Map<string, PullRequestFile>();
  for (const file of [...tracked, ...untracked]) {
    if (!byPath.has(file.path)) byPath.set(file.path, file);
  }
  const files = [...byPath.values()].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
  return { branch, files };
}
