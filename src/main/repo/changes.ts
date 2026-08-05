import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  CommitResult,
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

const diffArgs = ["-M", "--no-color", "--no-ext-diff"];

// The index against HEAD — what a commit would record.
async function stagedChanges(repoPath: string): Promise<PullRequestFile[]> {
  let output: string;
  try {
    output = await git(repoPath, ["diff", "--cached", "HEAD", ...diffArgs]);
  } catch {
    // A repo with no commits yet has no HEAD — diff against the empty tree
    // so staged files still show.
    output = await git(repoPath, ["diff", "--cached", emptyTree, ...diffArgs]);
  }
  return parseGitDiff(output);
}

// The working tree against the index — what a commit would leave behind.
// Needs no HEAD, so it works in a repo with no commits.
async function unstagedChanges(repoPath: string): Promise<PullRequestFile[]> {
  return parseGitDiff(await git(repoPath, ["diff", ...diffArgs]));
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

function byPath(files: PullRequestFile[]): PullRequestFile[] {
  // "git rm --cached" leaves a path both deleted-in-index and untracked;
  // keep the first (tracked) entry so paths stay unique within a group.
  const unique = new Map<string, PullRequestFile>();
  for (const file of files) {
    if (!unique.has(file.path)) unique.set(file.path, file);
  }
  return [...unique.values()].sort((a, b) => a.path.localeCompare(b.path));
}

// Uncommitted work in a registered local checkout, split the way git sees it:
// the index (staged) and the working tree (unstaged, untracked files
// included). A partially staged path appears in both — that is git's model,
// not a bug. Each entry is shaped like a PR's changed file so the diff UI
// renders them unchanged.
export async function getLocalChanges(repoPath: string): Promise<LocalChanges> {
  const [branch, staged, unstaged, untracked] = await Promise.all([
    currentBranch(repoPath),
    stagedChanges(repoPath),
    unstagedChanges(repoPath),
    untrackedChanges(repoPath),
  ]);
  return {
    branch,
    staged: byPath(staged),
    unstaged: byPath([...unstaged, ...untracked]),
    // Reported rather than inferred from the status letter: discarding an
    // untracked file deletes it, and that warning must not rest on a guess.
    untracked: untracked.map((file) => file.path).sort(),
  };
}

// git reports a failed command through the error's stderr; the message alone
// is the whole command line, which tells the user nothing. Pre-commit hooks,
// an unset user.email, and index locks all surface here.
function gitError(error: unknown, fallback: string): Error {
  const stderr = (error as { stderr?: unknown }).stderr;
  const text = typeof stderr === "string" ? stderr.trim() : "";
  return new Error(text === "" ? fallback : text);
}

// "add -A" so a deleted or untracked path stages like any other.
export async function stageFiles(
  repoPath: string,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;
  try {
    await git(repoPath, ["add", "-A", "--", ...paths]);
  } catch (error) {
    throw gitError(error, "Couldn't stage those files.");
  }
}

export async function unstageFiles(
  repoPath: string,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;
  try {
    await git(repoPath, ["restore", "--staged", "--", ...paths]);
  } catch (error) {
    try {
      // No HEAD to restore from yet — the first commit's staged files can
      // only leave the index by being removed from it.
      await git(repoPath, ["rm", "--cached", "-r", "--", ...paths]);
    } catch {
      throw gitError(error, "Couldn't unstage those files.");
    }
  }
}

// Throws away uncommitted work: tracked paths are restored from the index
// (so staged work survives — only the unstaged edits go), untracked paths are
// deleted outright. Nothing here is recoverable through git, which is why the
// renderer confirms first.
export async function discardChanges(
  repoPath: string,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;
  // Ask git which of these it doesn't track, rather than trusting the caller.
  const listed = await git(repoPath, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    ...paths,
  ]);
  const untracked = new Set(listed.split("\0").filter(Boolean));
  const tracked = paths.filter((path) => !untracked.has(path));
  try {
    if (tracked.length > 0) {
      await git(repoPath, ["restore", "--worktree", "--", ...tracked]);
    }
    if (untracked.size > 0) {
      await git(repoPath, ["clean", "-f", "--", ...untracked]);
    }
  } catch (error) {
    throw gitError(error, "Couldn't discard those changes.");
  }
}

// Commits what is staged, and only that — never "commit -a". The message is
// passed as an argument, not a shell string, so newlines and quotes are safe.
export async function commitChanges(
  repoPath: string,
  message: string,
): Promise<CommitResult> {
  const trimmed = message.trim();
  if (trimmed === "") throw new Error("A commit needs a message.");
  try {
    await git(repoPath, ["commit", "-m", trimmed]);
  } catch (error) {
    throw gitError(error, "Couldn't create the commit.");
  }
  const sha = (await git(repoPath, ["rev-parse", "--short", "HEAD"])).trim();
  return { sha, subject: trimmed.split("\n")[0] };
}
