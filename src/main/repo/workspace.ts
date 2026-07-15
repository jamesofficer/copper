import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fetchPullRequestRef, git, hasCommit } from "./git";
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

async function upgradeToFullClone(slug: string): Promise<string> {
  const dir = await ensureRepo(slug);
  const filter = await git([
    "-C",
    dir,
    "config",
    "--get",
    "remote.origin.partialclonefilter",
  ]).catch(() => "");
  if (!filter.trim()) return dir;
  await git([
    "-C",
    dir,
    "config",
    "--unset",
    "remote.origin.partialclonefilter",
  ]);
  await git(["-C", dir, "fetch", "--refetch", "origin"]);
  return dir;
}

const upgrades = new Map<string, Promise<string>>();

// Content search needs every blob — lazy per-file fetching would be unusably
// slow — so the first grep upgrades the blobless clone to a full one. One-off
// per repo; no-op once the partial-clone filter is gone.
export function ensureFullClone(slug: string): Promise<string> {
  const inFlight = upgrades.get(slug);
  if (inFlight) return inFlight;
  const task = upgradeToFullClone(slug).finally(() => upgrades.delete(slug));
  upgrades.set(slug, task);
  return task;
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
  } catch (cause) {
    console.warn(
      `Workspace warm-up failed for ${repo}#${prNumber}:`,
      cause instanceof Error ? cause.message : cause,
    );
  }
}
