import type {
  FileStatus,
  MergeMethod,
  NewReviewComment,
  PullRequest,
  PullRequestComment,
  PullRequestCommit,
  PullRequestDetail,
  PullRequestFile,
  PullRequestReview,
  ReviewComment,
  ReviewState,
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
  mergeable: boolean | null;
  mergeable_state: string;
  base: { ref: string };
  head: { sha: string; ref: string };
  labels: Array<{ name: string; color: string }>;
  requested_reviewers: Array<{ login: string }> | null;
  additions: number;
  deletions: number;
  changed_files: number;
  commits: number;
  comments: number;
  review_comments: number;
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

  // Deletes come back as 204 with no body.
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// The login the stored token belongs to — the renderer uses it to decide
// which comments offer a delete button.
export async function getViewer(): Promise<string> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error("Connect a GitHub token in settings first.");
  }
  const user = await githubFetch<{ login: string }>(token, "/user");
  return user.login;
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
  id: number;
  user: { login: string } | null;
  state: string;
  body: string | null;
  submitted_at: string | null;
}

async function fetchReviews(
  token: string,
  repo: string,
  prNumber: number,
): Promise<GitHubReview[]> {
  return githubFetch<GitHubReview[]>(
    token,
    `/repos/${repo}/pulls/${prNumber}/reviews?per_page=100`,
  );
}

const reviewStates: Record<string, ReviewState> = {
  APPROVED: "approved",
  CHANGES_REQUESTED: "changes_requested",
  COMMENTED: "commented",
  DISMISSED: "dismissed",
};

// Mirrors GitHub's review decision. Reviews arrive oldest-first, so each
// reviewer's latest APPROVED/CHANGES_REQUESTED wins; a dismissal wipes their
// vote; COMMENTED and PENDING reviews don't count.
function reviewStatusFrom(reviews: GitHubReview[]): ReviewStatus {
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

function toPullRequest(
  repo: string,
  pull: GitHubPullDetail,
  reviewStatus: ReviewStatus,
): PullRequest {
  return {
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
    comments: pull.comments + pull.review_comments,
  };
}

async function getReviewStatus(
  token: string,
  repo: string,
  prNumber: number,
): Promise<ReviewStatus> {
  return reviewStatusFrom(await fetchReviews(token, repo, prNumber));
}

// Every submitted review, oldest first. PENDING reviews (drafts the author
// hasn't submitted) and any state GitHub adds later are dropped.
export async function listPullRequestReviews(
  repo: string,
  prNumber: number,
): Promise<PullRequestReview[]> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error(
      "Connect a GitHub token in settings to load pull requests.",
    );
  }

  const reviews = await fetchReviews(token, repo, prNumber);
  return reviews.flatMap((review) => {
    const state = reviewStates[review.state];
    if (!state || !review.submitted_at) return [];
    return [
      {
        id: review.id,
        author: review.user?.login ?? "unknown",
        state,
        body: review.body ?? "",
        submittedAt: review.submitted_at,
      },
    ];
  });
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

  return details.map(({ pull, reviewStatus }) =>
    toPullRequest(repo, pull, reviewStatus),
  );
}

interface GitHubSearchIssues {
  items: Array<{ number: number; repository_url: string }>;
}

// Open PRs across all repos where the logged-in user's review is requested,
// most recently updated first. Returns [] when no token is set — this feeds a
// passive sidebar section and the setup banner already prompts for the token.
export async function listReviewRequestedPullRequests(): Promise<
  PullRequest[]
> {
  const token = await getGitHubToken();
  if (!token) return [];

  const query = encodeURIComponent(
    "is:pr is:open archived:false review-requested:@me",
  );
  const search = await githubFetch<GitHubSearchIssues>(
    token,
    `/search/issues?q=${query}&sort=updated&order=desc&per_page=20&advanced_search=true`,
  );

  return Promise.all(
    search.items.map(async (item) => {
      const repo = item.repository_url.split("/repos/")[1];
      const [pull, reviewStatus] = await Promise.all([
        githubFetch<GitHubPullDetail>(
          token,
          `/repos/${repo}/pulls/${item.number}`,
        ),
        getReviewStatus(token, repo, item.number),
      ]);
      return toPullRequest(repo, pull, reviewStatus);
    }),
  );
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
    mergeable: pull.mergeable,
    mergeableState: pull.mergeable_state,
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
    comments: pull.comments + pull.review_comments,
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

function toPullRequestFile(file: GitHubFile): PullRequestFile {
  return {
    path: file.filename,
    previousPath: file.previous_filename ?? null,
    status: toFileStatus(file.status),
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patch ?? null,
  };
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

  return files.map(toPullRequestFile);
}

interface GitHubCommitItem {
  sha: string;
  commit: {
    message: string;
    author: { name?: string; date?: string } | null;
  };
  author: { login: string } | null;
}

export async function listPullRequestCommits(
  repo: string,
  prNumber: number,
): Promise<PullRequestCommit[]> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error(
      "Connect a GitHub token in settings to load pull requests.",
    );
  }

  const commits: GitHubCommitItem[] = [];
  // GitHub caps this endpoint at 250 commits (3 pages of 100).
  for (let page = 1; page <= 3; page++) {
    const batch = await githubFetch<GitHubCommitItem[]>(
      token,
      `/repos/${repo}/pulls/${prNumber}/commits?per_page=100&page=${page}`,
    );
    commits.push(...batch);
    if (batch.length < 100) break;
  }

  return commits.map((item) => ({
    sha: item.sha,
    subject: item.commit.message.split("\n", 1)[0],
    author: item.author?.login ?? item.commit.author?.name ?? "unknown",
    date: item.commit.author?.date ?? "",
  }));
}

export async function listCommitFiles(
  repo: string,
  commitSha: string,
): Promise<PullRequestFile[]> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error(
      "Connect a GitHub token in settings to load pull requests.",
    );
  }

  const files: GitHubFile[] = [];
  // The single-commit endpoint pages its `files` array like the PR files one.
  for (let page = 1; page <= 30; page++) {
    const commit = await githubFetch<{ files?: GitHubFile[] }>(
      token,
      `/repos/${repo}/commits/${commitSha}?per_page=100&page=${page}`,
    );
    const batch = commit.files ?? [];
    files.push(...batch);
    if (batch.length < 100) break;
  }

  return files.map(toPullRequestFile);
}

interface GitHubIssueComment {
  id: number;
  body: string | null;
  user: { login: string } | null;
  created_at: string;
}

// Conversation comments on the PR (GitHub's issue comments), oldest first.
// Inline review comments on diff lines are a separate endpoint.
export async function listPullRequestComments(
  repo: string,
  prNumber: number,
): Promise<PullRequestComment[]> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error(
      "Connect a GitHub token in settings to load pull requests.",
    );
  }

  const comments: GitHubIssueComment[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await githubFetch<GitHubIssueComment[]>(
      token,
      `/repos/${repo}/issues/${prNumber}/comments?per_page=100&page=${page}`,
    );
    comments.push(...batch);
    if (batch.length < 100) break;
  }

  return comments.map(toPullRequestComment);
}

function toPullRequestComment(comment: GitHubIssueComment): PullRequestComment {
  return {
    id: comment.id,
    author: comment.user?.login ?? "unknown",
    body: comment.body ?? "",
    createdAt: comment.created_at,
  };
}

export async function addPullRequestComment(
  repo: string,
  prNumber: number,
  body: string,
): Promise<PullRequestComment> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error("Connect a GitHub token in settings to comment.");
  }

  const comment = await githubFetch<GitHubIssueComment>(
    token,
    `/repos/${repo}/issues/${prNumber}/comments`,
    { method: "POST", body: { body } },
  );

  return toPullRequestComment(comment);
}

interface GitHubReviewComment {
  id: number;
  body: string | null;
  user: { login: string } | null;
  created_at: string;
  path: string;
  line: number | null;
  start_line: number | null;
  side: "LEFT" | "RIGHT";
  in_reply_to_id?: number;
  diff_hunk: string | null;
}

function toReviewComment(comment: GitHubReviewComment): ReviewComment {
  return {
    id: comment.id,
    author: comment.user?.login ?? "unknown",
    body: comment.body ?? "",
    createdAt: comment.created_at,
    path: comment.path,
    line: comment.line,
    startLine: comment.start_line,
    side: comment.side,
    inReplyTo: comment.in_reply_to_id ?? null,
    diffHunk: comment.diff_hunk ?? "",
  };
}

// Inline review comments on the PR's diff, oldest first.
export async function listReviewComments(
  repo: string,
  prNumber: number,
): Promise<ReviewComment[]> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error(
      "Connect a GitHub token in settings to load pull requests.",
    );
  }

  const comments: GitHubReviewComment[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await githubFetch<GitHubReviewComment[]>(
      token,
      `/repos/${repo}/pulls/${prNumber}/comments?per_page=100&page=${page}`,
    );
    comments.push(...batch);
    if (batch.length < 100) break;
  }

  return comments.map(toReviewComment);
}

export async function addReviewComment(
  repo: string,
  prNumber: number,
  comment: NewReviewComment,
): Promise<ReviewComment> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error("Connect a GitHub token in settings to comment.");
  }

  const created = await githubFetch<GitHubReviewComment>(
    token,
    `/repos/${repo}/pulls/${prNumber}/comments`,
    {
      method: "POST",
      body: {
        body: comment.body,
        commit_id: comment.commitId,
        path: comment.path,
        line: comment.line,
        side: comment.side,
        // GitHub rejects start_line unless it's strictly before line.
        ...(comment.startLine !== null && comment.startLine < comment.line
          ? { start_line: comment.startLine, start_side: comment.side }
          : {}),
      },
    },
  );

  return toReviewComment(created);
}

export async function replyToReviewComment(
  repo: string,
  prNumber: number,
  commentId: number,
  body: string,
): Promise<ReviewComment> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error("Connect a GitHub token in settings to comment.");
  }

  const created = await githubFetch<GitHubReviewComment>(
    token,
    `/repos/${repo}/pulls/${prNumber}/comments/${commentId}/replies`,
    { method: "POST", body: { body } },
  );

  return toReviewComment(created);
}

export async function deleteReviewComment(
  repo: string,
  commentId: number,
): Promise<void> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error("Connect a GitHub token in settings to delete comments.");
  }

  await githubFetch<undefined>(
    token,
    `/repos/${repo}/pulls/comments/${commentId}`,
    { method: "DELETE", body: undefined },
  );
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

export async function mergePullRequest(
  repo: string,
  prNumber: number,
  method: MergeMethod,
): Promise<void> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error("Connect a GitHub token in settings to merge.");
  }

  await githubFetch(token, `/repos/${repo}/pulls/${prNumber}/merge`, {
    method: "PUT",
    body: { merge_method: method },
  });
}
