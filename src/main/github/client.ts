import { isRateLimitMessage, RATE_LIMIT_MESSAGE } from "../../shared/rateLimit";
import type {
  FileStatus,
  MergeMethod,
  NewPullRequest,
  NewReviewComment,
  PullRequest,
  PullRequestActivity,
  PullRequestComment,
  PullRequestCommit,
  PullRequestDetail,
  PullRequestFile,
  PullRequestReactions,
  PullRequestReview,
  ReactionContent,
  ReactionGroup,
  RepoBranchInfo,
  RepoIssue,
  RepoIssueDetail,
  RepoMergeSettings,
  ReviewComment,
  ReviewDecision,
  ReviewState,
  ReviewStatus,
  ReviewVerdict,
} from "../../shared/types";
import { OPEN_PULL_REQUEST_LIMIT, REPO_ISSUE_LIMIT } from "../../shared/types";
import { getLocalCheckoutBranch, listRepositories } from "../repo/local";
import { clearDraftComments, listDraftComments } from "../store/drafts";
import { getGitHubToken } from "./auth";
import { githubRequest, hasGraphQlRateLimitError } from "./rateLimit";

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
  assignees: Array<{ login: string }> | null;
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
  const res = await githubRequest(token, path, init);

  if (res.status === 401) {
    throw new Error("GitHub rejected your token. Re-check it in settings.");
  }
  if (res.status === 404) {
    throw new Error(
      "Couldn't find this repository on GitHub. Check its origin remote.",
    );
  }
  if (res.status === 403 || res.status === 429) {
    const detail = await githubErrorDetail(res);
    throw new Error(
      isRateLimitMessage(detail)
        ? RATE_LIMIT_MESSAGE
        : detail
          ? `GitHub: ${detail}`
          : `GitHub returned status ${res.status}.`,
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

  // A GraphQL rate limit arrives as a 200 whose body carries the error, so it
  // never reaches the status checks above. Catching it here rather than at each
  // GraphQL call site means every one of them reports it identically — and by
  // now the gate has already backed off and given up.
  const body = (await res.json()) as T;
  if (hasGraphQlRateLimitError(body)) throw new Error(RATE_LIMIT_MESSAGE);
  return body;
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
    commits: pull.commits,
    comments: pull.comments + pull.review_comments,
    assignees: (pull.assignees ?? []).map((assignee) => assignee.login),
    createdAt: pull.created_at,
    updatedAt: pull.updated_at,
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

// Everything a PullRequest needs, in one GraphQL selection. REST needs three
// requests per PR to cover this (summary, detail, reviews), which is what put
// 100 requests in flight for a 50-PR repo and tripped the secondary rate
// limit. Kept as a shared fragment so the repo list and the search list can
// never drift apart.
const PR_FIELDS = `
  number
  title
  url
  isDraft
  state
  headRefOid
  additions
  deletions
  changedFiles
  commits { totalCount }
  createdAt
  updatedAt
  author { __typename login }
  assignees(first: 20) { nodes { login } }
  repository { nameWithOwner }
  latestOpinionatedReviews(first: 50) { nodes { state } }
  comments { totalCount }
  reviews(first: 100) { nodes { comments { totalCount } } }
`;

interface GraphQlPullRequest {
  number: number;
  title: string;
  url: string;
  isDraft: boolean;
  state: "OPEN" | "CLOSED" | "MERGED";
  headRefOid: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: { totalCount: number };
  createdAt: string;
  updatedAt: string;
  author: { __typename: string; login: string } | null;
  assignees: { nodes: Array<{ login: string } | null> };
  repository: { nameWithOwner: string };
  latestOpinionatedReviews: { nodes: Array<{ state: string } | null> } | null;
  comments: { totalCount: number };
  reviews: {
    nodes: Array<{ comments: { totalCount: number } } | null>;
  } | null;
}

// REST reports a bot as "renovate[bot]", GraphQL as "renovate" with a Bot
// typename. The rest of the app is REST-fed (the PR detail, the Author filter,
// and UserAvatar, which builds avatars.githubusercontent.com/{login}), and
// "renovate" without the suffix is a different account, so restore the suffix
// here rather than let a list row disagree with the PR it opens.
function actorLogin(
  actor: { __typename: string; login: string } | null,
): string {
  if (!actor) return "unknown";
  return actor.__typename === "Bot" ? `${actor.login}[bot]` : actor.login;
}

// latestOpinionatedReviews is GitHub's own "one opinionated review per
// reviewer", so it already applies the rules reviewStatusFrom has to derive by
// hand from the REST list: newest per reviewer wins, dismissals drop out, and
// COMMENTED/PENDING reviews never appear.
function fromGraphQlPullRequest(pull: GraphQlPullRequest): PullRequest {
  const states = (pull.latestOpinionatedReviews?.nodes ?? []).map(
    (review) => review?.state,
  );
  const reviewStatus: ReviewStatus = states.includes("CHANGES_REQUESTED")
    ? "changes_requested"
    : states.includes("APPROVED")
      ? "approved"
      : "awaiting_review";

  // Matches REST's comments + review_comments. Deliberately not GraphQL's
  // totalCommentsCount, which also counts review summary bodies — that would
  // make a card's count disagree with the PR detail's own count. Only a PR
  // with more than 100 reviews under-reports, which no real PR reaches.
  const inlineComments = (pull.reviews?.nodes ?? []).reduce(
    (total, review) => total + (review?.comments.totalCount ?? 0),
    0,
  );

  return {
    repo: pull.repository.nameWithOwner,
    number: pull.number,
    title: pull.title,
    author: actorLogin(pull.author),
    draft: pull.isDraft,
    reviewStatus,
    headSha: pull.headRefOid.slice(0, 7),
    url: pull.url,
    additions: pull.additions,
    deletions: pull.deletions,
    changedFiles: pull.changedFiles,
    commits: pull.commits.totalCount,
    comments: pull.comments.totalCount + inlineComments,
    assignees: (pull.assignees.nodes ?? []).flatMap((assignee) =>
      assignee ? [assignee.login] : [],
    ),
    createdAt: pull.createdAt,
    updatedAt: pull.updatedAt,
  };
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

  const [owner, name] = repo.split("/");
  const response = await githubFetch<{
    data?: {
      repository?: {
        pullRequests: { nodes: Array<GraphQlPullRequest | null> };
      };
    };
    errors?: Array<{ message: string }>;
  }>(token, "/graphql", {
    method: "POST",
    body: {
      query: `query ($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          pullRequests(
            states: OPEN
            orderBy: { field: UPDATED_AT, direction: DESC }
            first: ${OPEN_PULL_REQUEST_LIMIT}
          ) {
            nodes { ${PR_FIELDS} }
          }
        }
      }`,
      variables: { owner, name },
    },
  });

  // GraphQL answers partial errors with the data it could resolve, and a node
  // it couldn't comes back as null for the flatMap to skip. So only the absence
  // of nodes is fatal — raising on any error would throw away a good list.
  const nodes = response.data?.repository?.pullRequests.nodes;
  if (!nodes) {
    const detail = response.errors?.[0]?.message;
    throw new Error(
      detail
        ? `GitHub: ${detail}`
        : "Couldn't find this repository on GitHub. Check its origin remote.",
    );
  }

  return nodes.flatMap((pull) => (pull ? [fromGraphQlPullRequest(pull)] : []));
}

// Open PRs matching a search qualifier, limited to the repositories added to
// the app, most recently updated first. Returns [] when no token is set —
// these feed passive sidebar sections and the setup banner already prompts
// for the token.
async function searchOpenPullRequests(
  qualifier: string,
): Promise<PullRequest[]> {
  const token = await getGitHubToken();
  if (!token) return [];

  const repositories = await listRepositories();
  const registeredSlugs = new Set(
    repositories.flatMap((repo) =>
      repo.slug ? [repo.slug.toLowerCase()] : [],
    ),
  );
  if (registeredSlugs.size === 0) return [];

  const response = await githubFetch<{
    data?: { search: { nodes: Array<GraphQlPullRequest | null> } };
    errors?: Array<{ message: string }>;
  }>(token, "/graphql", {
    method: "POST",
    body: {
      query: `query ($q: String!) {
        search(query: $q, type: ISSUE, first: 20) {
          nodes { ... on PullRequest { ${PR_FIELDS} } }
        }
      }`,
      variables: {
        q: `is:pr is:open archived:false sort:updated-desc ${qualifier}`,
      },
    },
  });

  const nodes = response.data?.search.nodes;
  if (!nodes) {
    const detail = response.errors?.[0]?.message;
    throw new Error(detail ? `GitHub: ${detail}` : "GitHub search failed.");
  }

  // The search index lags behind a PR closing or merging by a while, so a PR
  // just closed in the app can still come back as a hit. The nodes are live PR
  // objects, so trust their state over the search index.
  return nodes.flatMap((pull) => {
    if (pull?.state !== "OPEN") return [];
    if (!registeredSlugs.has(pull.repository.nameWithOwner.toLowerCase())) {
      return [];
    }
    return [fromGraphQlPullRequest(pull)];
  });
}

export function listReviewRequestedPullRequests(): Promise<PullRequest[]> {
  return searchOpenPullRequests("review-requested:@me");
}

export function listMyPullRequests(): Promise<PullRequest[]> {
  return searchOpenPullRequests("author:@me");
}

const ISSUE_FIELDS = `
  number
  title
  url
  createdAt
  updatedAt
  author { __typename login }
  assignees(first: 20) { nodes { login } }
  labels(first: 20) { nodes { name color } }
  repository { nameWithOwner }
  comments { totalCount }
`;

interface GraphQlIssue {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  author: { __typename: string; login: string } | null;
  assignees: { nodes: Array<{ login: string } | null> };
  labels: { nodes: Array<{ name: string; color: string } | null> } | null;
  repository: { nameWithOwner: string };
  comments: { totalCount: number };
}

function fromGraphQlIssue(issue: GraphQlIssue): RepoIssue {
  return {
    repo: issue.repository.nameWithOwner,
    number: issue.number,
    title: issue.title,
    author: actorLogin(issue.author),
    url: issue.url,
    labels: (issue.labels?.nodes ?? []).flatMap((label) =>
      label ? [{ name: label.name, color: label.color }] : [],
    ),
    assignees: (issue.assignees.nodes ?? []).flatMap((assignee) =>
      assignee ? [assignee.login] : [],
    ),
    comments: issue.comments.totalCount,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

// GraphQL rather than REST because `GET /repos/{repo}/issues` returns pull
// requests mixed in — every caller has to filter them out by hand. The issues
// connection excludes them by construction.
export async function listRepoIssues(repo: string): Promise<RepoIssue[]> {
  if (!repo.includes("/")) {
    throw new Error(
      "This repository has no GitHub remote, so issues can't be loaded.",
    );
  }

  const token = await getGitHubToken();
  if (!token) {
    throw new Error("Connect a GitHub token in settings to load issues.");
  }

  const [owner, name] = repo.split("/");
  const response = await githubFetch<{
    data?: {
      repository?: { issues: { nodes: Array<GraphQlIssue | null> } };
    };
    errors?: Array<{ message: string }>;
  }>(token, "/graphql", {
    method: "POST",
    body: {
      query: `query ($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          issues(
            states: OPEN
            orderBy: { field: UPDATED_AT, direction: DESC }
            first: ${REPO_ISSUE_LIMIT}
          ) {
            nodes { ${ISSUE_FIELDS} }
          }
        }
      }`,
      variables: { owner, name },
    },
  });

  // As in listReviewRequests: GraphQL answers partial errors with the data it
  // could resolve, so only the absence of nodes is fatal.
  const nodes = response.data?.repository?.issues.nodes;
  if (!nodes) {
    const detail = response.errors?.[0]?.message;
    throw new Error(
      detail
        ? `GitHub: ${detail}`
        : "Couldn't find this repository on GitHub. Check its origin remote.",
    );
  }

  return nodes.flatMap((issue) => (issue ? [fromGraphQlIssue(issue)] : []));
}

interface GitHubIssueDetail {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  state_reason: "completed" | "not_planned" | "duplicate" | "reopened" | null;
  user: { login: string } | null;
  labels: Array<{ name: string; color: string }>;
  assignees: Array<{ login: string }> | null;
  comments: number;
  created_at: string;
  updated_at: string;
  html_url: string;
}

// REST here, unlike the list: one issue's body is the point of the call, and
// the list deliberately leaves bodies off the wire.
export async function getRepoIssue(
  repo: string,
  issueNumber: number,
): Promise<RepoIssueDetail> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error("Connect a GitHub token in settings to load issues.");
  }

  const issue = await githubFetch<GitHubIssueDetail>(
    token,
    `/repos/${repo}/issues/${issueNumber}`,
  );

  return {
    repo,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    author: issue.user?.login ?? "unknown",
    state: issue.state,
    stateReason: issue.state_reason,
    url: issue.html_url,
    labels: issue.labels.map((label) => ({
      name: label.name,
      color: label.color,
    })),
    assignees: (issue.assignees ?? []).map((assignee) => assignee.login),
    comments: issue.comments,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
  };
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
    assignees: (pull.assignees ?? []).map((assignee) => assignee.login),
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

// ETag per PR so unchanged polls answer 304 — which GitHub doesn't count
// against the rate limit — and reuse the last snapshot.
const activityCache = new Map<
  string,
  { etag: string; activity: PullRequestActivity }
>();

// The refresh-button poll. Best-effort by design: any failure (no token,
// network, API error) returns null so the caller just skips the highlight.
export async function peekPullRequestActivity(
  repo: string,
  prNumber: number,
): Promise<PullRequestActivity | null> {
  const token = await getGitHubToken();
  if (!token) return null;

  const key = `${repo}#${prNumber}`;
  const cached = activityCache.get(key);

  try {
    const res = await githubRequest(token, `/repos/${repo}/pulls/${prNumber}`, {
      headers: cached ? { "If-None-Match": cached.etag } : undefined,
    });

    if (res.status === 304 && cached) return cached.activity;
    if (!res.ok) return null;

    const pull = (await res.json()) as GitHubPullDetail;
    const activity: PullRequestActivity = {
      updatedAt: pull.updated_at,
      headSha: pull.head.sha,
      commits: pull.commits,
      comments: pull.comments + pull.review_comments,
    };
    const etag = res.headers.get("etag");
    if (etag) activityCache.set(key, { etag, activity });
    return activity;
  } catch {
    return null;
  }
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
  node_id: string;
  body: string | null;
  user: { login: string } | null;
  created_at: string;
}

// Conversation comments, oldest first. One endpoint serves both a PR's
// conversation and a real issue's — GitHub numbers issues and pull requests in
// a single sequence per repo, so the number alone picks the right thread.
// Inline review comments on diff lines are a separate endpoint.
export async function listIssueComments(
  repo: string,
  issueNumber: number,
): Promise<PullRequestComment[]> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error("Connect a GitHub token in settings to load comments.");
  }

  const comments: GitHubIssueComment[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await githubFetch<GitHubIssueComment[]>(
      token,
      `/repos/${repo}/issues/${issueNumber}/comments?per_page=100&page=${page}`,
    );
    comments.push(...batch);
    if (batch.length < 100) break;
  }

  return comments.map(toPullRequestComment);
}

function toPullRequestComment(comment: GitHubIssueComment): PullRequestComment {
  return {
    id: comment.id,
    nodeId: comment.node_id,
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
  node_id: string;
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
    nodeId: comment.node_id,
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

interface GraphQlReactionGroup {
  content: ReactionContent;
  viewerHasReacted: boolean;
  reactors: { totalCount: number };
}

interface GraphQlReactableComment {
  databaseId: number | null;
  reactionGroups: GraphQlReactionGroup[] | null;
}

interface GraphQlReactions {
  data?: {
    repository?: {
      pullRequest?: {
        comments?: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: GraphQlReactableComment[];
        };
        reviewThreads?: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{ comments: { nodes: GraphQlReactableComment[] } }>;
        };
      } | null;
    } | null;
  };
  errors?: Array<{ message: string }>;
}

const REACTION_GROUPS = `
  reactionGroups { content viewerHasReacted reactors { totalCount } }`;

// GitHub returns a group per emoji whether or not anyone used it, so the
// empty ones are dropped here.
function toReactionGroups(
  groups: GraphQlReactionGroup[] | null,
): ReactionGroup[] {
  return (groups ?? [])
    .filter((group) => group.reactors.totalCount > 0)
    .map((group) => ({
      content: group.content,
      count: group.reactors.totalCount,
      viewerHasReacted: group.viewerHasReacted,
    }));
}

function collect(
  into: PullRequestReactions,
  comments: GraphQlReactableComment[],
): void {
  for (const comment of comments) {
    if (comment.databaseId == null) continue;
    const groups = toReactionGroups(comment.reactionGroups);
    if (groups.length > 0) into[comment.databaseId] = groups;
  }
}

// Every reaction on the PR's comments — conversation comments and inline
// review comments alike — keyed by the REST comment id the renderer knows.
// GraphQL, not REST: REST's reaction summary can't say whether the signed-in
// user reacted, which would mean a request per comment to find out. No token
// means no reactions rather than an error — they're decoration on a view that
// must still render.
export async function listReactions(
  repo: string,
  prNumber: number,
): Promise<PullRequestReactions> {
  const token = await getGitHubToken();
  if (!token) return {};

  const [owner, name] = repo.split("/");
  const variables = { owner, name, number: prNumber };
  const reactions: PullRequestReactions = {};

  const conversationQuery = `
    query ($owner: String!, $name: String!, $number: Int!, $cursor: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          comments(first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes { databaseId ${REACTION_GROUPS} }
          }
        }
      }
    }`;

  let cursor: string | null = null;
  do {
    const response: GraphQlReactions = await githubFetch<GraphQlReactions>(
      token,
      "/graphql",
      {
        method: "POST",
        body: { query: conversationQuery, variables: { ...variables, cursor } },
      },
    );
    if (response.errors?.length) {
      throw new Error(`GitHub: ${response.errors[0].message}`);
    }
    const comments = response.data?.repository?.pullRequest?.comments;
    if (!comments) break;
    collect(reactions, comments.nodes);
    cursor = comments.pageInfo.hasNextPage ? comments.pageInfo.endCursor : null;
  } while (cursor);

  const threadQuery = `
    query ($owner: String!, $name: String!, $number: Int!, $cursor: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          reviewThreads(first: 50, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
              comments(first: 100) {
                nodes { databaseId ${REACTION_GROUPS} }
              }
            }
          }
        }
      }
    }`;

  cursor = null;
  do {
    const response: GraphQlReactions = await githubFetch<GraphQlReactions>(
      token,
      "/graphql",
      {
        method: "POST",
        body: { query: threadQuery, variables: { ...variables, cursor } },
      },
    );
    if (response.errors?.length) {
      throw new Error(`GitHub: ${response.errors[0].message}`);
    }
    const threads = response.data?.repository?.pullRequest?.reviewThreads;
    if (!threads) break;
    for (const thread of threads.nodes)
      collect(reactions, thread.comments.nodes);
    cursor = threads.pageInfo.hasNextPage ? threads.pageInfo.endCursor : null;
  } while (cursor);

  return reactions;
}

// Add or take back one of the signed-in user's reactions. GraphQL takes the
// emoji itself, so removing needs no lookup of the reaction's own id (which is
// all REST's delete endpoint accepts).
export async function setReaction(
  subjectId: string,
  content: ReactionContent,
  reacted: boolean,
): Promise<void> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error("Connect a GitHub token in settings to react to comments.");
  }

  const field = reacted ? "addReaction" : "removeReaction";
  const mutation = `
    mutation ($subjectId: ID!, $content: ReactionContent!) {
      ${field}(input: { subjectId: $subjectId, content: $content }) {
        clientMutationId
      }
    }`;

  const response = await githubFetch<{ errors?: Array<{ message: string }> }>(
    token,
    "/graphql",
    {
      method: "POST",
      body: { query: mutation, variables: { subjectId, content } },
    },
  );
  if (response.errors?.length) {
    throw new Error(`GitHub: ${response.errors[0].message}`);
  }
}

// Whether merging still waits on required review approval — GraphQL only;
// REST's pull detail doesn't carry reviewDecision. Null (no review
// requirement), no token, or a failed lookup all mean "don't block merging".
export async function getReviewDecision(
  repo: string,
  prNumber: number,
): Promise<ReviewDecision> {
  const token = await getGitHubToken();
  if (!token) return null;

  const [owner, name] = repo.split("/");
  const query = `
    query ($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) { reviewDecision }
      }
    }`;

  const response = await githubFetch<{
    data?: {
      repository?: {
        pullRequest?: { reviewDecision: ReviewDecision } | null;
      } | null;
    };
    errors?: Array<{ message: string }>;
  }>(token, "/graphql", {
    method: "POST",
    body: { query, variables: { owner, name, number: prNumber } },
  });

  return response.data?.repository?.pullRequest?.reviewDecision ?? null;
}

// Close or reopen a pull request. Merged PRs can't change state — GitHub
// rejects the PATCH.
export async function setPullRequestState(
  repo: string,
  prNumber: number,
  state: "open" | "closed",
): Promise<void> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error(
      "Connect a GitHub token in settings to update pull requests.",
    );
  }

  await githubFetch(token, `/repos/${repo}/pulls/${prNumber}`, {
    method: "PATCH",
    body: { state },
  });
}

// Retarget an open PR onto a different base branch. GitHub recomputes the
// diff against the new base.
export async function setPullRequestBase(
  repo: string,
  prNumber: number,
  base: string,
): Promise<void> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error(
      "Connect a GitHub token in settings to update pull requests.",
    );
  }

  await githubFetch(token, `/repos/${repo}/pulls/${prNumber}`, {
    method: "PATCH",
    body: { base },
  });
}

// Take the token's own user off a PR's requested reviewers. GitHub needs push
// access on the repo for this, and a request that came from a team or
// CODEOWNERS can be re-added by a later push — the error surfaces to the user
// either way.
export async function removeReviewRequest(
  repo: string,
  prNumber: number,
): Promise<void> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error(
      "Connect a GitHub token in settings to update pull requests.",
    );
  }

  const viewer = await getViewer();
  await githubFetch(
    token,
    `/repos/${repo}/pulls/${prNumber}/requested_reviewers`,
    { method: "DELETE", body: { reviewers: [viewer] } },
  );
}

export async function setPullRequestBody(
  repo: string,
  prNumber: number,
  body: string,
): Promise<void> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error(
      "Connect a GitHub token in settings to update pull requests.",
    );
  }

  await githubFetch(token, `/repos/${repo}/pulls/${prNumber}`, {
    method: "PATCH",
    body: { body },
  });
}

// Take a draft PR out of draft — GitHub's "Ready for review". GraphQL only;
// there's no REST endpoint for it.
export async function setPullRequestReady(
  repo: string,
  prNumber: number,
): Promise<void> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error(
      "Connect a GitHub token in settings to update pull requests.",
    );
  }

  const pullRequestId = await getPullRequestNodeId(token, repo, prNumber);
  const result = await githubFetch<{ errors?: Array<{ message: string }> }>(
    token,
    "/graphql",
    {
      method: "POST",
      body: {
        query: `
          mutation ($pullRequestId: ID!) {
            markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
              pullRequest { id }
            }
          }`,
        variables: { pullRequestId },
      },
    },
  );
  if (result.errors?.length) {
    throw new Error(`GitHub: ${result.errors[0].message}`);
  }
}

const reviewEvents: Record<ReviewVerdict, string> = {
  comment: "COMMENT",
  approve: "APPROVE",
  request_changes: "REQUEST_CHANGES",
};

// Submits the review with any locally drafted inline comments attached —
// GitHub creates the review and all its comments in one call, so the author
// gets a single notification. Drafts are only cleared after it succeeds.
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

  const drafts = await listDraftComments(repo, prNumber);
  const comments = drafts.map((draft) => ({
    path: draft.path,
    body: draft.body,
    line: draft.line,
    side: draft.side,
    ...(draft.startLine !== null
      ? { start_line: draft.startLine, start_side: draft.side }
      : {}),
  }));

  await githubFetch(token, `/repos/${repo}/pulls/${prNumber}/reviews`, {
    method: "POST",
    body: {
      event: reviewEvents[verdict],
      ...(body ? { body } : {}),
      ...(comments.length > 0 ? { comments } : {}),
    },
  });
  if (drafts.length > 0) await clearDraftComments(repo, prNumber);
}

interface GraphQlReviewThreads {
  data?: {
    repository?: {
      pullRequest?: {
        reviewThreads: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{
            isResolved: boolean;
            comments: { nodes: Array<{ databaseId: number | null }> };
          }>;
        };
      } | null;
    } | null;
  };
  errors?: Array<{ message: string }>;
}

// Root-comment ids of the PR's resolved inline threads. Thread resolution
// only exists in GitHub's GraphQL API — REST review comments carry no
// resolved flag — so this is a separate lookup joined to listReviewComments
// by the thread's first comment id.
export async function listResolvedReviewThreads(
  repo: string,
  prNumber: number,
): Promise<number[]> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error(
      "Connect a GitHub token in settings to load pull requests.",
    );
  }

  const [owner, name] = repo.split("/");
  const query = `
    query ($owner: String!, $name: String!, $number: Int!, $cursor: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          reviewThreads(first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
              isResolved
              comments(first: 1) { nodes { databaseId } }
            }
          }
        }
      }
    }`;

  const resolved: number[] = [];
  let cursor: string | null = null;
  do {
    const response: GraphQlReviewThreads =
      await githubFetch<GraphQlReviewThreads>(token, "/graphql", {
        method: "POST",
        body: { query, variables: { owner, name, number: prNumber, cursor } },
      });
    if (response.errors?.length) {
      throw new Error(`GitHub: ${response.errors[0].message}`);
    }
    const threads = response.data?.repository?.pullRequest?.reviewThreads;
    if (!threads) break;
    for (const node of threads.nodes) {
      const rootId = node.comments.nodes[0]?.databaseId;
      if (node.isResolved && rootId != null) resolved.push(rootId);
    }
    cursor = threads.pageInfo.hasNextPage ? threads.pageInfo.endCursor : null;
  } while (cursor);
  return resolved;
}

interface GraphQlThreadIds {
  data?: {
    repository?: {
      pullRequest?: {
        reviewThreads: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{
            id: string;
            comments: { nodes: Array<{ databaseId: number | null }> };
          }>;
        };
      } | null;
    } | null;
  };
  errors?: Array<{ message: string }>;
}

// Resolve or unresolve an inline thread. Like resolution state, the mutation
// only exists in GraphQL and wants the thread's node id — looked up by
// matching the thread's first comment to the REST root comment id.
export async function setReviewThreadResolved(
  repo: string,
  prNumber: number,
  rootCommentId: number,
  resolved: boolean,
): Promise<void> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error("Connect a GitHub token in settings to resolve threads.");
  }

  const [owner, name] = repo.split("/");
  const lookup = `
    query ($owner: String!, $name: String!, $number: Int!, $cursor: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          reviewThreads(first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              comments(first: 1) { nodes { databaseId } }
            }
          }
        }
      }
    }`;

  let threadId: string | undefined;
  let cursor: string | null = null;
  do {
    const response: GraphQlThreadIds = await githubFetch<GraphQlThreadIds>(
      token,
      "/graphql",
      {
        method: "POST",
        body: {
          query: lookup,
          variables: { owner, name, number: prNumber, cursor },
        },
      },
    );
    if (response.errors?.length) {
      throw new Error(`GitHub: ${response.errors[0].message}`);
    }
    const threads = response.data?.repository?.pullRequest?.reviewThreads;
    if (!threads) break;
    threadId = threads.nodes.find(
      (node) => node.comments.nodes[0]?.databaseId === rootCommentId,
    )?.id;
    cursor =
      !threadId && threads.pageInfo.hasNextPage
        ? threads.pageInfo.endCursor
        : null;
  } while (cursor);

  if (!threadId) {
    throw new Error("GitHub: couldn’t find the review thread to resolve.");
  }

  const mutation = resolved
    ? `mutation ($threadId: ID!) {
        resolveReviewThread(input: { threadId: $threadId }) {
          thread { isResolved }
        }
      }`
    : `mutation ($threadId: ID!) {
        unresolveReviewThread(input: { threadId: $threadId }) {
          thread { isResolved }
        }
      }`;

  const result = await githubFetch<{ errors?: Array<{ message: string }> }>(
    token,
    "/graphql",
    { method: "POST", body: { query: mutation, variables: { threadId } } },
  );
  if (result.errors?.length) {
    throw new Error(`GitHub: ${result.errors[0].message}`);
  }
}

interface GraphQlViewedFiles {
  data?: {
    repository?: {
      pullRequest?: {
        files: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{ path: string; viewerViewedState: string }>;
        } | null;
      } | null;
    } | null;
  };
  errors?: Array<{ message: string }>;
}

// Paths the viewer has marked as viewed — GitHub's own per-file checkbox
// state, which only exists in GraphQL. DISMISSED (the file changed after it
// was viewed) deliberately counts as not viewed, matching github.com.
export async function listViewedFiles(
  repo: string,
  prNumber: number,
): Promise<string[]> {
  const token = await getGitHubToken();
  if (!token) return [];

  const [owner, name] = repo.split("/");
  const query = `
    query ($owner: String!, $name: String!, $number: Int!, $cursor: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          files(first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes { path viewerViewedState }
          }
        }
      }
    }`;

  const viewed: string[] = [];
  let cursor: string | null = null;
  do {
    const response: GraphQlViewedFiles = await githubFetch<GraphQlViewedFiles>(
      token,
      "/graphql",
      {
        method: "POST",
        body: { query, variables: { owner, name, number: prNumber, cursor } },
      },
    );
    if (response.errors?.length) {
      throw new Error(`GitHub: ${response.errors[0].message}`);
    }
    const files = response.data?.repository?.pullRequest?.files;
    if (!files) break;
    for (const node of files.nodes) {
      if (node.viewerViewedState === "VIEWED") viewed.push(node.path);
    }
    cursor = files.pageInfo.hasNextPage ? files.pageInfo.endCursor : null;
  } while (cursor);
  return viewed;
}

// PR node ids never change, so the mark/unmark mutations only pay for the
// lookup once per PR per app run.
const prNodeIds = new Map<string, string>();

async function getPullRequestNodeId(
  token: string,
  repo: string,
  prNumber: number,
): Promise<string> {
  const key = `${repo}#${prNumber}`;
  const cached = prNodeIds.get(key);
  if (cached) return cached;

  const [owner, name] = repo.split("/");
  const response = await githubFetch<{
    data?: {
      repository?: { pullRequest?: { id: string } | null } | null;
    };
    errors?: Array<{ message: string }>;
  }>(token, "/graphql", {
    method: "POST",
    body: {
      query: `
        query ($owner: String!, $name: String!, $number: Int!) {
          repository(owner: $owner, name: $name) {
            pullRequest(number: $number) { id }
          }
        }`,
      variables: { owner, name, number: prNumber },
    },
  });
  if (response.errors?.length) {
    throw new Error(`GitHub: ${response.errors[0].message}`);
  }
  const id = response.data?.repository?.pullRequest?.id;
  if (!id) {
    throw new Error("GitHub: couldn’t find the pull request.");
  }
  prNodeIds.set(key, id);
  return id;
}

// Mark or unmark a changed file as viewed — the same state GitHub's file
// checkboxes write, so it stays in sync with github.com.
export async function setFileViewed(
  repo: string,
  prNumber: number,
  path: string,
  viewed: boolean,
): Promise<void> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error("Connect a GitHub token in settings to mark files viewed.");
  }

  const pullRequestId = await getPullRequestNodeId(token, repo, prNumber);
  const mutation = viewed
    ? `mutation ($pullRequestId: ID!, $path: String!) {
        markFileAsViewed(input: { pullRequestId: $pullRequestId, path: $path }) {
          pullRequest { id }
        }
      }`
    : `mutation ($pullRequestId: ID!, $path: String!) {
        unmarkFileAsViewed(input: { pullRequestId: $pullRequestId, path: $path }) {
          pullRequest { id }
        }
      }`;

  const result = await githubFetch<{ errors?: Array<{ message: string }> }>(
    token,
    "/graphql",
    {
      method: "POST",
      body: { query: mutation, variables: { pullRequestId, path } },
    },
  );
  if (result.errors?.length) {
    throw new Error(`GitHub: ${result.errors[0].message}`);
  }
}

// Open-PR counts for every registered repo, keyed by slug — one aliased
// GraphQL query instead of a REST call per repo. Counts are decorative
// (sidebar badges), so no token or an inaccessible repo just means no entry.
export async function getOpenPullRequestCounts(): Promise<
  Record<string, number>
> {
  const token = await getGitHubToken();
  if (!token) return {};

  const slugs: string[] = [];
  for (const repo of await listRepositories()) {
    if (repo.slug && !slugs.includes(repo.slug)) slugs.push(repo.slug);
  }
  if (slugs.length === 0) return {};

  const parts = slugs.map((slug, index) => {
    const [owner, name] = slug.split("/");
    return `r${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(
      name,
    )}) { pullRequests(states: OPEN) { totalCount } }`;
  });

  const response = await githubFetch<{
    data?: Record<string, { pullRequests: { totalCount: number } } | null>;
    errors?: Array<{ message: string }>;
  }>(token, "/graphql", {
    method: "POST",
    body: { query: `query { ${parts.join(" ")} }` },
  });

  // Partial errors (one inaccessible repo) still return data for the rest.
  const counts: Record<string, number> = {};
  slugs.forEach((slug, index) => {
    const count = response.data?.[`r${index}`]?.pullRequests.totalCount;
    if (count !== undefined) counts[slug] = count;
  });
  return counts;
}

interface GraphQlBranches {
  data?: {
    repository?: {
      defaultBranchRef: { name: string } | null;
      refs: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: Array<{
          name: string;
          target: { committedDate?: string } | null;
        }>;
      } | null;
    } | null;
  };
  errors?: Array<{ message: string }>;
}

// What the new-PR dialog needs: the repo's branches sorted newest commit
// first (REST can't sort branches by activity, so this is a GraphQL refs
// query — which returns the default branch in the same call), plus the local
// checkout's current branch, pinned to the top when it's on GitHub.
// GitHub looks for a PR template under the repo root, docs/, and .github/,
// case-insensitively, with or without an extension. These are the paths real
// repos actually use, in the order GitHub itself prefers.
const PR_TEMPLATE_PATHS = [
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/pull_request_template.md",
  "PULL_REQUEST_TEMPLATE.md",
  "pull_request_template.md",
  "docs/PULL_REQUEST_TEMPLATE.md",
  "docs/pull_request_template.md",
];

// Reads a repo file at a ref via the contents API, or null if it's not there.
// Not githubFetch: a missing file is a 404 we want to treat as "no template",
// not an error.
async function fetchRepoFile(
  token: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string | null> {
  const res = await githubRequest(
    token,
    `/repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`,
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { content?: string; encoding?: string };
  if (body.encoding !== "base64" || !body.content) return null;
  return Buffer.from(body.content, "base64").toString("utf8");
}

// The repo's PR template from the default branch, or null. Probes the
// conventional locations in parallel and keeps the highest-priority hit;
// (a directory of templates — .github/PULL_REQUEST_TEMPLATE/ — isn't handled,
// since there's no single default to prefill).
async function fetchPullRequestTemplate(
  token: string,
  repo: string,
  ref: string,
): Promise<string | null> {
  if (!ref) return null;
  const results = await Promise.all(
    PR_TEMPLATE_PATHS.map((path) => fetchRepoFile(token, repo, path, ref)),
  );
  const found = results.find((content) => content && content.trim().length > 0);
  return found ?? null;
}

export async function getBranchInfo(repo: string): Promise<RepoBranchInfo> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error("Connect a GitHub token in settings to load branches.");
  }

  const [owner, name] = repo.split("/");
  const query = `
    query ($owner: String!, $name: String!, $cursor: String) {
      repository(owner: $owner, name: $name) {
        defaultBranchRef { name }
        refs(refPrefix: "refs/heads/", first: 100, after: $cursor,
             orderBy: { field: ALPHABETICAL, direction: ASC }) {
          pageInfo { hasNextPage endCursor }
          nodes {
            name
            target { ... on Commit { committedDate } }
          }
        }
      }
    }`;

  const branches: string[] = [];
  const branchDates: Record<string, string> = {};
  let defaultBranch = "";
  let cursor: string | null = null;
  do {
    const response: GraphQlBranches = await githubFetch<GraphQlBranches>(
      token,
      "/graphql",
      { method: "POST", body: { query, variables: { owner, name, cursor } } },
    );
    if (response.errors?.length) {
      throw new Error(`GitHub: ${response.errors[0].message}`);
    }
    const repository = response.data?.repository;
    if (!repository?.refs) break;
    defaultBranch = repository.defaultBranchRef?.name ?? defaultBranch;
    for (const node of repository.refs.nodes) {
      branches.push(node.name);
      const date = node.target?.committedDate;
      if (date) branchDates[node.name] = date;
    }
    // Cap at 500 branches — plenty for a picker. Paging is alphabetical, so a
    // repo over the cap is truncated by name before the sort below sees it.
    cursor =
      repository.refs.pageInfo.hasNextPage && branches.length < 500
        ? repository.refs.pageInfo.endCursor
        : null;
  } while (cursor);

  // Sort by last commit here rather than in the query: GitHub's only
  // date-ish RefOrder field is TAG_COMMIT_DATE, and for refs/heads it's
  // ignored — asking for it DESC just returns reverse alphabetical. Branches
  // whose target isn't a commit (so carry no date) sort last.
  branches.sort((a, b) => {
    const dateA = branchDates[a];
    const dateB = branchDates[b];
    if (!dateA && !dateB) return a.localeCompare(b);
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateB.localeCompare(dateA);
  });

  const localBranch = await getLocalCheckoutBranch(repo);
  if (localBranch) {
    const index = branches.indexOf(localBranch);
    if (index > 0) {
      branches.splice(index, 1);
      branches.unshift(localBranch);
    }
  }

  // Templates live on the base branch; the new-PR dialog defaults base to the
  // default branch, so read it there. Best-effort — a lookup failure just
  // means no prefill.
  let pullRequestTemplate: string | null = null;
  try {
    pullRequestTemplate = await fetchPullRequestTemplate(
      token,
      repo,
      defaultBranch,
    );
  } catch {
    pullRequestTemplate = null;
  }

  return {
    branches,
    branchDates,
    defaultBranch,
    localBranch,
    pullRequestTemplate,
  };
}

export async function createPullRequest(
  repo: string,
  pr: NewPullRequest,
): Promise<PullRequest> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error(
      "Connect a GitHub token in settings to create pull requests.",
    );
  }

  const created = await githubFetch<GitHubPullDetail>(
    token,
    `/repos/${repo}/pulls`,
    {
      method: "POST",
      body: {
        title: pr.title,
        head: pr.head,
        base: pr.base,
        body: pr.body,
        draft: pr.draft,
      },
    },
  );

  return toPullRequest(repo, created, "awaiting_review");
}

// Which merge methods the repo's settings allow. Missing fields (older
// GitHub Enterprise) count as allowed, matching GitHub's defaults.
export async function getRepoMergeSettings(
  repo: string,
): Promise<RepoMergeSettings> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error(
      "Connect a GitHub token in settings to load pull requests.",
    );
  }

  const data = await githubFetch<{
    allow_merge_commit?: boolean;
    allow_squash_merge?: boolean;
    allow_rebase_merge?: boolean;
  }>(token, `/repos/${repo}`);

  const allowedMethods: MergeMethod[] = [];
  if (data.allow_merge_commit !== false) allowedMethods.push("merge");
  if (data.allow_squash_merge !== false) allowedMethods.push("squash");
  if (data.allow_rebase_merge !== false) allowedMethods.push("rebase");
  return { allowedMethods };
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
