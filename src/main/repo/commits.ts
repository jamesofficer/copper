import type {
  LocalCommit,
  LocalCommitList,
  PullRequestFile,
  PushResult,
} from "../../shared/types";
import { gitError, parseGitDiff, runGit } from "./changes";

// The panel is a short branch review aid, not a replacement for git log.
const maxCommits = 20;

// Field separator inside one log entry; entries themselves are NUL-terminated
// by "-z". Both characters can't appear in a commit message.
const fieldSeparator = "\x1f";

async function refExists(repoPath: string, ref: string): Promise<boolean> {
  try {
    await runGit(repoPath, [
      "rev-parse",
      "--verify",
      "--quiet",
      `${ref}^{commit}`,
    ]);
    return true;
  } catch {
    return false;
  }
}

// The branch the repo treats as its trunk. origin/HEAD is the honest answer
// when it's set; the well-known names are the fallback for a clone that never
// recorded it.
async function defaultBranchRef(repoPath: string): Promise<string | null> {
  try {
    const head = (
      await runGit(repoPath, [
        "symbolic-ref",
        "--short",
        "refs/remotes/origin/HEAD",
      ])
    ).trim();
    if (head !== "") return head;
  } catch {
    // No origin/HEAD recorded — fall through to the well-known names.
  }
  for (const ref of ["origin/main", "origin/master", "main", "master"]) {
    if (await refExists(repoPath, ref)) return ref;
  }
  return null;
}

async function upstreamRef(repoPath: string): Promise<string | null> {
  try {
    const ref = (
      await runGit(repoPath, [
        "rev-parse",
        "--abbrev-ref",
        "--symbolic-full-name",
        "@{upstream}",
      ])
    ).trim();
    return ref === "" ? null : ref;
  } catch {
    return null;
  }
}

async function aheadOf(repoPath: string, base: string): Promise<number> {
  try {
    const count = (
      await runGit(repoPath, ["rev-list", "--count", `${base}..HEAD`])
    ).trim();
    return Number.parseInt(count, 10) || 0;
  } catch {
    return 0;
  }
}

function branchNameForRef(ref: string): string {
  return ref.startsWith("origin/") ? ref.slice("origin/".length) : ref;
}

// A feature branch is always compared with trunk, even when it has no unique
// commits. This prevents an empty feature branch from falling back to trunk's
// whole recent history. Trunk uses its upstream only while it is ahead; when
// it is level, recent trunk history is the useful view.
async function resolveBase(
  repoPath: string,
  branch: string | null,
): Promise<string | null> {
  const [trunk, upstream] = await Promise.all([
    defaultBranchRef(repoPath),
    upstreamRef(repoPath),
  ]);
  if (trunk && branch && branch !== branchNameForRef(trunk)) return trunk;
  if (upstream && (await aheadOf(repoPath, upstream)) > 0) return upstream;
  return null;
}

async function currentBranch(repoPath: string): Promise<string | null> {
  try {
    return (await runGit(repoPath, ["symbolic-ref", "--short", "HEAD"])).trim();
  } catch {
    return null;
  }
}

function parseLog(output: string): LocalCommit[] {
  const commits: LocalCommit[] = [];
  for (const entry of output.split("\0")) {
    if (entry.trim() === "") continue;
    const fields = entry.split(fieldSeparator);
    if (fields.length < 4) continue;
    const [sha, subject, author, date, ...rest] = fields;
    commits.push({
      sha,
      subject,
      author,
      date,
      body: rest.join(fieldSeparator).trim(),
    });
  }
  return commits;
}

// The commits on the checkout's current branch, newest first, for the commit
// list on the home screen's Changes tab. Local git only — no token, no
// network, and it works on a repo with no GitHub slug.
export async function listLocalCommits(
  repoPath: string,
): Promise<LocalCommitList> {
  const branch = await currentBranch(repoPath);
  const base = await resolveBase(repoPath, branch);

  let output = "";
  try {
    output = await runGit(repoPath, [
      "log",
      "-z",
      `--max-count=${maxCommits}`,
      `--format=%H${fieldSeparator}%s${fieldSeparator}%an${fieldSeparator}%aI${fieldSeparator}%b`,
      base ? `${base}..HEAD` : "HEAD",
    ]);
  } catch {
    // A repo with no commits yet has no HEAD to log — an empty branch, not an
    // error worth showing.
    return { branch, base, commits: [] };
  }
  return { branch, base, commits: parseLog(output) };
}

interface UpstreamPushTarget {
  remote: string;
  remoteRef: string;
  label: string;
}

async function upstreamPushTarget(
  repoPath: string,
  branch: string,
): Promise<UpstreamPushTarget | null> {
  const output = (
    await runGit(repoPath, [
      "for-each-ref",
      "--format=%(upstream:remotename)%00%(upstream:remoteref)%00%(upstream:short)",
      `refs/heads/${branch}`,
    ])
  ).trim();
  const [remote, remoteRef, label] = output.split("\0");
  return remote && remoteRef && label ? { remote, remoteRef, label } : null;
}

async function remoteForNewUpstream(repoPath: string): Promise<string> {
  const remotes = (await runGit(repoPath, ["remote"]))
    .split("\n")
    .map((remote) => remote.trim())
    .filter(Boolean);
  if (remotes.includes("origin")) return "origin";
  if (remotes.length === 1) return remotes[0];
  if (remotes.length === 0) {
    throw new Error("This repository has no Git remote to push to.");
  }
  throw new Error(
    "This branch has no upstream. Set one before pushing because the repository has more than one remote.",
  );
}

// Pushes only the checked-out branch. Existing upstream configuration selects
// the remote and destination. A new branch uses origin, or the only remote.
export async function pushLocalBranch(repoPath: string): Promise<PushResult> {
  const branch = await currentBranch(repoPath);
  if (!branch) throw new Error("Check out a branch before pushing.");

  const upstream = await upstreamPushTarget(repoPath, branch);
  if (upstream) {
    try {
      await runGit(repoPath, [
        "push",
        upstream.remote,
        `refs/heads/${branch}:${upstream.remoteRef}`,
      ]);
    } catch (error) {
      throw gitError(error, "Couldn't push this branch.");
    }
    return { branch, target: upstream.label };
  }

  const remote = await remoteForNewUpstream(repoPath);
  try {
    await runGit(repoPath, [
      "push",
      "--set-upstream",
      remote,
      `refs/heads/${branch}:refs/heads/${branch}`,
    ]);
  } catch (error) {
    throw gitError(error, "Couldn't push this branch.");
  }
  return { branch, target: `${remote}/${branch}` };
}

// One commit's changes, shaped like a PR's changed files so the diff UI renders
// them unchanged. A merge is diffed against its first parent — git's combined
// diff is a different format, and this one is meant to answer "what did this
// commit bring in".
export async function getLocalCommitFiles(
  repoPath: string,
  sha: string,
): Promise<PullRequestFile[]> {
  if (!/^[0-9a-f]{4,40}$/i.test(sha)) {
    throw new Error("That is not a commit id.");
  }
  const output = await runGit(repoPath, [
    "show",
    sha,
    "--format=",
    "--patch",
    "-m",
    "--first-parent",
    "-M",
    "--no-color",
    "--no-ext-diff",
  ]);
  return parseGitDiff(output);
}
