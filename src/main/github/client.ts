import type {
  FileStatus,
  PullRequest,
  PullRequestDetail,
  PullRequestFile,
  ReviewStatus,
  ReviewVerdict,
} from "../../shared/types";
import { getGitHubToken } from "./auth";

const API = "https://api.github.com";

interface GitHubPullSummary {
  number: number;
  title: string;
  user: { login: string } | null;
  head: { sha: string };
  html_url: string;
}

interface GitHubPullDetail extends GitHubPullSummary {
  body: string | null;
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
  base: { ref: string };
  head: { sha: string; ref: string };
  labels: Array<{ name: string; color: string }>;
  requested_reviewers: Array<{ login: string }> | null;
  additions: number;
  deletions: number;
  changed_files: number;
  commits: number;
  created_at: string;
  updated_at: string;
}

async function githubFetch<T>(
  token: string,
  path: string,
  init?: { method: string; body: unknown },
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "pr-reviewer",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init ? { "Content-Type": "application/json" } : {}),
    },
    body: init ? JSON.stringify(init.body) : undefined,
  });

  if (res.status === 401) {
    throw new Error("GitHub rejected your token. Re-check it in settings.");
  }
  if (res.status === 404) {
    throw new Error(
      "Couldn't find this repository on GitHub. Check its origin remote.",
    );
  }
  if (!res.ok) {
    const detail = await githubErrorDetail(res);
    throw new Error(
      detail ? `GitHub: ${detail}` : `GitHub returned status ${res.status}.`,
    );
  }

  return res.json() as Promise<T>;
}

// GitHub's error bodies put the useful text in `message`, and validation
// failures (422) often carry the real reason in `errors` instead — e.g.
// "Can not approve your own pull request".
async function githubErrorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      message?: string;
      errors?: Array<string | { message?: string }>;
    };
    const errors = (body.errors ?? [])
      .map((error) =>
        typeof error === "string" ? error : (error.message ?? ""),
      )
      .filter(Boolean);
    return errors.join(" ") || body.message || "";
  } catch {
    return "";
  }
}

interface GitHubReview {
  user: { login: string } | null;
  state: string;
}

// Mirrors GitHub's review decision. Reviews arrive oldest-first, so each
// reviewer's latest APPROVED/CHANGES_REQUESTED wins; a dismissal wipes their
// vote; COMMENTED and PENDING reviews don't count.
async function getReviewStatus(
  token: string,
  repo: string,
  prNumber: number,
): Promise<ReviewStatus> {
  const reviews = await githubFetch<GitHubReview[]>(
    token,
    `/repos/${repo}/pulls/${prNumber}/reviews?per_page=100`,
  );

  const latestByReviewer = new Map<string, string>();
  for (const review of reviews) {
    if (!review.user) continue;
    if (review.state === "APPROVED" || review.state === "CHANGES_REQUESTED") {
      latestByReviewer.set(review.user.login, review.state);
    } else if (review.state === "DISMISSED") {
      latestByReviewer.delete(review.user.login);
    }
  }

  const states = [...latestByReviewer.values()];
  if (states.includes("CHANGES_REQUESTED")) return "changes_requested";
  if (states.includes("APPROVED")) return "approved";
  return "awaiting_review";
}

export async function listReviewRequests(repo: string): Promise<PullRequest[]> {
  if (!repo.includes("/")) {
    throw new Error(
      "This repository has no GitHub remote, so pull requests can't be loaded.",
    );
  }

  const token = await getGitHubToken();
  if (!token) {
    throw new Error(
      "Connect a GitHub token in settings to load pull requests.",
    );
  }

  const summaries = await githubFetch<GitHubPullSummary[]>(
    token,
    `/repos/${repo}/pulls?state=open&sort=updated&direction=desc&per_page=50`,
  );

  const details = await Promise.all(
    summaries.map(async (summary) => {
      const [pull, reviewStatus] = await Promise.all([
        githubFetch<GitHubPullDetail>(
          token,
          `/repos/${repo}/pulls/${summary.number}`,
        ),
        getReviewStatus(token, repo, summary.number),
      ]);
      return { pull, reviewStatus };
    }),
  );

  return details.map(({ pull, reviewStatus }) => ({
    repo,
    number: pull.number,
    title: pull.title,
    author: pull.user?.login ?? "unknown",
    draft: pull.draft,
    reviewStatus,
    headSha: pull.head.sha.slice(0, 7),
    url: pull.html_url,
    additions: pull.additions,
    deletions: pull.deletions,
    changedFiles: pull.changed_files,
  }));
}

export async function getPullRequest(
  repo: string,
  prNumber: number,
): Promise<PullRequestDetail> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error(
      "Connect a GitHub token in settings to load pull requests.",
    );
  }

  const [pull, reviewStatus] = await Promise.all([
    githubFetch<GitHubPullDetail>(token, `/repos/${repo}/pulls/${prNumber}`),
    getReviewStatus(token, repo, prNumber),
  ]);

  return {
    repo,
    number: pull.number,
    title: pull.title,
    body: pull.body,
    author: pull.user?.login ?? "unknown",
    state: pull.state,
    draft: pull.draft,
    merged: pull.merged,
    reviewStatus,
    baseRef: pull.base.ref,
    headRef: pull.head.ref,
    headSha: pull.head.sha,
    labels: pull.labels.map((label) => ({
      name: label.name,
      color: label.color,
    })),
    reviewers: (pull.requested_reviewers ?? []).map(
      (reviewer) => reviewer.login,
    ),
    additions: pull.additions,
    deletions: pull.deletions,
    changedFiles: pull.changed_files,
    commits: pull.commits,
    createdAt: pull.created_at,
    updatedAt: pull.updated_at,
    url: pull.html_url,
  };
}

interface GitHubFile {
  filename: string;
  previous_filename?: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

function toFileStatus(status: string): FileStatus {
  switch (status) {
    case "added":
      return "added";
    case "removed":
      return "deleted";
    case "renamed":
      return "renamed";
    default:
      return "modified";
  }
}

export async function listPullRequestFiles(
  repo: string,
  prNumber: number,
): Promise<PullRequestFile[]> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error(
      "Connect a GitHub token in settings to load pull requests.",
    );
  }

  const files: GitHubFile[] = [];
  // GitHub caps the files endpoint at 3000 files (30 pages of 100).
  for (let page = 1; page <= 30; page++) {
    const batch = await githubFetch<GitHubFile[]>(
      token,
      `/repos/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
    );
    files.push(...batch);
    if (batch.length < 100) break;
  }

  return files.map((file) => ({
    path: file.filename,
    previousPath: file.previous_filename ?? null,
    status: toFileStatus(file.status),
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patch ?? null,
  }));
}

const reviewEvents: Record<ReviewVerdict, string> = {
  comment: "COMMENT",
  approve: "APPROVE",
  request_changes: "REQUEST_CHANGES",
};

export async function submitReview(
  repo: string,
  prNumber: number,
  verdict: ReviewVerdict,
  body: string,
): Promise<void> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error("Connect a GitHub token in settings to submit reviews.");
  }

  await githubFetch(token, `/repos/${repo}/pulls/${prNumber}/reviews`, {
    method: "POST",
    body: {
      event: reviewEvents[verdict],
      ...(body ? { body } : {}),
    },
  });
}
