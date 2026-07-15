import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getSecret } from "../store/secrets";

const run = promisify(execFile);

// git show on a large file can produce a lot of output.
const MAX_BUFFER = 32 * 1024 * 1024;
// Generous — a first blob backfill of a big repo is legitimately slow — but
// bounded so a wedged network call can't hang a chat answer forever.
const TIMEOUT_MS = 10 * 60 * 1000;
// Blob ids per fetch: 5000 × 41 bytes stays well under the OS argv limit.
const FETCH_CHUNK = 5000;

// The token is passed per-command through the environment instead of the
// remote URL so it never lands in the clone's config on disk. Every command
// gets it: in a blobless clone even local-looking reads (show, log -p) can
// trigger a lazy blob fetch from the promisor remote.
async function gitEnv(): Promise<NodeJS.ProcessEnv> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
  };
  const token = await getSecret("github");
  if (token) {
    const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
    env.GIT_CONFIG_COUNT = "1";
    env.GIT_CONFIG_KEY_0 = "http.https://github.com/.extraheader";
    env.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${basic}`;
  }
  return env;
}

export async function git(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await run("git", args, {
    cwd,
    env: await gitEnv(),
    maxBuffer: MAX_BUFFER,
    timeout: TIMEOUT_MS,
  });
  return stdout;
}

// GitHub publishes every PR's head commit at refs/pull/<n>/head, so this
// works for fork PRs too. Mirrored to the same local ref name.
export async function fetchPullRequestRef(
  repoDir: string,
  prNumber: number,
): Promise<void> {
  await git([
    "-C",
    repoDir,
    "fetch",
    "--no-tags",
    "origin",
    `+refs/pull/${prNumber}/head:refs/pull/${prNumber}/head`,
  ]);
}

export async function hasCommit(
  repoDir: string,
  sha: string,
): Promise<boolean> {
  try {
    await git(["-C", repoDir, "cat-file", "-e", `${sha}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

// Reads a file as it exists at a commit — no checkout involved.
export function showFile(
  repoDir: string,
  sha: string,
  path: string,
): Promise<string> {
  return git(["-C", repoDir, "show", `${sha}:${path}`]);
}

// Full file listing at a commit. Tree-only, so it never fetches blobs.
export async function listFiles(
  repoDir: string,
  sha: string,
): Promise<string[]> {
  const out = await git(["-C", repoDir, "ls-tree", "-r", "--name-only", sha]);
  return out.split("\n").filter(Boolean);
}

export function logForPath(
  repoDir: string,
  sha: string,
  path?: string,
  limit = 20,
): Promise<string> {
  const args = [
    "-C",
    repoDir,
    "log",
    `--max-count=${limit}`,
    "--format=%h %ad %an%n  %s",
    "--date=short",
    sha,
  ];
  if (path) args.push("--", path);
  return git(args);
}

// Blobs of the commit's tree that aren't in the object store yet. "Missing"
// already accounts for objects borrowed from the donor checkout (alternates),
// and --missing=print never triggers lazy fetching itself.
export async function listMissingBlobs(
  repoDir: string,
  sha: string,
): Promise<string[]> {
  const out = await git([
    "-C",
    repoDir,
    "rev-list",
    "--objects",
    "--missing=print",
    "--no-object-names",
    `${sha}^{tree}`,
  ]);
  return out
    .split("\n")
    .filter((line) => line.startsWith("?"))
    .map((line) => line.slice(1));
}

// Download specific blobs by id in batched requests — the same want-by-oid
// fetch git's lazy fetching uses, minus the one-request-per-blob overhead.
// noop negotiation skips the have/want dance; we only state wants.
export async function fetchBlobs(
  repoDir: string,
  oids: string[],
): Promise<void> {
  for (let start = 0; start < oids.length; start += FETCH_CHUNK) {
    await git([
      "-C",
      repoDir,
      "-c",
      "fetch.negotiationAlgorithm=noop",
      "fetch",
      "origin",
      "--no-tags",
      "--no-write-fetch-head",
      "--recurse-submodules=no",
      ...oids.slice(start, start + FETCH_CHUNK),
    ]);
  }
}

// Search file contents at a commit. Backfill the tree's blobs first (see
// ensureHeadBlobs) — on a blobless clone this would otherwise lazily fetch
// every candidate blob one at a time.
export async function grepAtCommit(
  repoDir: string,
  sha: string,
  pattern: string,
  directory?: string,
): Promise<string> {
  try {
    const out = await git([
      "-C",
      repoDir,
      "grep",
      "-nE",
      "-e",
      pattern,
      sha,
      ...(directory ? ["--", directory] : []),
    ]);
    // Matches come back as "<sha>:path:line:content" — drop the sha noise.
    return out.replaceAll(`${sha}:`, "");
  } catch (cause) {
    if ((cause as { code?: number }).code === 1) return "";
    throw cause;
  }
}
