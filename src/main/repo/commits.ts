import type {
  LocalCommit,
  LocalCommitList,
  PullRequestFile,
} from "../../shared/types";
import { parseGitDiff, runGit } from "./changes";

// Enough history for any branch worth reviewing commit by commit, and a hard
// stop on a long-lived branch that would otherwise ship thousands of entries
// over IPC.
const maxCommits = 200;

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

// What this branch should be compared against. The trunk comes first: on a
// feature branch "trunk..HEAD" is exactly the work done here. On the trunk
// itself that range is empty, so the upstream answers instead and the list
// becomes the unpushed commits. Neither having anything means the checkout is
// level with both, and recent history is the only useful thing left to show.
async function resolveBase(repoPath: string): Promise<string | null> {
  const [trunk, upstream] = await Promise.all([
    defaultBranchRef(repoPath),
    upstreamRef(repoPath),
  ]);
  const candidates = [trunk, upstream].filter(
    (ref, index, refs): ref is string =>
      ref !== null && refs.indexOf(ref) === index,
  );
  for (const base of candidates) {
    if ((await aheadOf(repoPath, base)) > 0) return base;
  }
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

// The commits on the checkout's current branch, newest first, for the home
// screen's Commits tab. Local git only — no token, no network, and it works on
// a repo with no GitHub slug.
export async function listLocalCommits(
  repoPath: string,
): Promise<LocalCommitList> {
  const [branch, base] = await Promise.all([
    currentBranch(repoPath),
    resolveBase(repoPath),
  ]);

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
