import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  fetchBlobs,
  fetchPullRequestRef,
  git,
  hasCommit,
  listMissingBlobs,
  showFile,
} from "./git";
import { listRepositories } from "./local";

// Refresh at most this often — ensureRepo is called on every PR open.
const SYNC_TTL_MS = 5 * 60 * 1000;

const pending = new Map<string, Promise<string>>();
const lastSynced = new Map<string, number>();

export function workspaceRoot(): string {
  return join(homedir(), ".pr-reviewer", "repos");
}

function repoDir(slug: string): string {
  return join(workspaceRoot(), `${slug.replace("/", "__")}.git`);
}

// Bare (no working files — everything is read straight from the object store,
// pinned to a commit) and blobless (commits and trees up front, file contents
// fetched lazily on first read), so clones are small and fast.
async function cloneRepo(slug: string, dir: string): Promise<void> {
  await mkdir(workspaceRoot(), { recursive: true });
  const args = ["clone", "--bare", "--filter=blob:none", "--no-tags"];

  // The user's local checkout can donate objects, making the clone near-instant.
  const donor = (await listRepositories()).find(
    (repo) => repo.slug === slug,
  )?.path;
  if (donor) args.push("--reference-if-able", donor);

  args.push(`https://github.com/${slug}.git`, dir);
  await git(args);

  // clone --bare doesn't set a fetch refspec; without one, later fetches
  // update nothing. Track all branches (tree/commit data only — still small).
  await git([
    "-C",
    dir,
    "config",
    "remote.origin.fetch",
    "+refs/heads/*:refs/heads/*",
  ]);
}

async function syncRepo(slug: string): Promise<string> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(slug)) {
    throw new Error(`Not a valid GitHub repository slug: ${slug}`);
  }
  const dir = repoDir(slug);
  if (!existsSync(dir)) {
    await cloneRepo(slug, dir);
  } else if (Date.now() - (lastSynced.get(slug) ?? 0) > SYNC_TTL_MS) {
    await git(["-C", dir, "fetch", "--prune", "origin"]);
  }
  lastSynced.set(slug, Date.now());
  return dir;
}

// Clones on first use, refreshes after that. Concurrent calls for the same
// repo share one in-flight sync instead of racing.
export function ensureRepo(slug: string): Promise<string> {
  const inFlight = pending.get(slug);
  if (inFlight) return inFlight;
  const task = syncRepo(slug).finally(() => pending.delete(slug));
  pending.set(slug, task);
  return task;
}

const backfills = new Map<string, Promise<void>>();
const backfilled = new Set<string>();

async function backfillHeadBlobs(slug: string, sha: string): Promise<void> {
  const dir = await ensureRepo(slug);
  const missing = await listMissingBlobs(dir, sha);
  if (missing.length > 0) await fetchBlobs(dir, missing);
}

// Content search needs the whole tree's blobs — lazy per-file fetching would
// be unusably slow — so before a grep (and during warm-up) we batch-download
// whatever the commit's tree is missing. The donor checkout and blobs pulled
// for earlier PRs already count as present, so this is usually a small delta.
export async function ensureHeadBlobs(
  slug: string,
  sha: string,
): Promise<void> {
  const key = `${slug}@${sha}`;
  if (backfilled.has(key)) return;
  const inFlight = backfills.get(key);
  if (inFlight) return inFlight;
  const task = backfillHeadBlobs(slug, sha).finally(() =>
    backfills.delete(key),
  );
  backfills.set(key, task);
  await task;
  backfilled.add(key);
}

// A file's full contents at a commit, read from the workspace clone — powers
// the diff viewer's context expansion, whole-file syntax highlighting, and
// full-file view. Null when the clone, commit, or file isn't available (the
// viewer quietly falls back to diff-only), or when the content looks binary.
export async function readFileAtCommit(
  slug: string,
  sha: string,
  path: string,
): Promise<string | null> {
  try {
    const dir = await ensureRepo(slug);
    const content = await showFile(dir, sha, path);
    return content.includes("\u0000") ? null : content;
  } catch {
    return null;
  }
}

// Fired in the background when a PR is opened so the workspace is usually
// ready by the time the chat needs it. Best-effort: failures are logged, the
// app keeps working diff-only.
export async function warmUpPullRequest(
  repo: string,
  prNumber: number,
  headSha: string,
): Promise<void> {
  try {
    const dir = await ensureRepo(repo);
    if (!(await hasCommit(dir, headSha))) {
      await fetchPullRequestRef(dir, prNumber);
    }
    await ensureHeadBlobs(repo, headSha);
  } catch (cause) {
    console.warn(
      `Workspace warm-up failed for ${repo}#${prNumber}:`,
      cause instanceof Error ? cause.message : cause,
    );
  }
}
