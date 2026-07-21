export interface Repository {
  path: string;
  name: string;
  slug: string | null;
}

// GitHub's review decision: each reviewer's latest submitted review counts,
// and one "request changes" outranks any number of approvals.
export type ReviewStatus = "approved" | "changes_requested" | "awaiting_review";

export interface PullRequest {
  repo: string;
  number: number;
  title: string;
  author: string;
  draft: boolean;
  reviewStatus: ReviewStatus;
  headSha: string;
  url: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  // Conversation + inline review comments combined.
  comments: number;
}

export interface PullRequestLabel {
  name: string;
  color: string;
}

export interface PullRequestDetail {
  repo: string;
  number: number;
  title: string;
  body: string | null;
  author: string;
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
  // GitHub computes this asynchronously; it's null until the check finishes.
  mergeable: boolean | null;
  // GitHub's mergeable_state, e.g. "clean", "dirty" (conflicts), "blocked".
  mergeableState: string;
  reviewStatus: ReviewStatus;
  baseRef: string;
  headRef: string;
  headSha: string;
  labels: PullRequestLabel[];
  reviewers: string[];
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
  comments: number;
  createdAt: string;
  updatedAt: string;
  url: string;
}

// How GitHub combines the PR's commits when merging.
export type MergeMethod = "merge" | "squash" | "rebase";

// Mirrors GitHub's review events: comment, approve, or request changes.
export type ReviewVerdict = "comment" | "approve" | "request_changes";

// A submitted review on the PR. Mirrors GitHub's review states; PENDING
// reviews aren't submitted yet, so they never reach the renderer.
export type ReviewState =
  | "approved"
  | "changes_requested"
  | "commented"
  | "dismissed";

export interface PullRequestReview {
  id: number;
  author: string;
  state: ReviewState;
  body: string;
  submittedAt: string;
}

// The voice the analysis text is written in. Changes only the wording of an
// analysis, never what it reports.
export const reviewPersonalities = [
  "standard",
  "technical",
  "non_technical",
  "simplified",
  "grug",
  "mentor",
  "concise",
] as const;

export type ReviewPersonality = (typeof reviewPersonalities)[number];

// A conversation comment on the PR itself (GitHub calls these issue
// comments) — not an inline review comment on a diff line.
export interface PullRequestComment {
  id: number;
  author: string;
  body: string;
  createdAt: string;
}

// Which side of the diff an inline comment anchors to: LEFT = the old file
// (deleted lines), RIGHT = the new file (added and context lines).
export type DiffSide = "LEFT" | "RIGHT";

// An inline review comment on a diff line (GitHub's PR review comments API)
// — distinct from PullRequestComment, which lives in the conversation.
export interface ReviewComment {
  id: number;
  author: string;
  body: string;
  createdAt: string;
  path: string;
  // Line numbers in the PR's current diff. null = outdated: the code the
  // comment pointed at has changed since it was written.
  line: number | null;
  startLine: number | null;
  side: DiffSide;
  inReplyTo: number | null;
  // The diff excerpt GitHub attaches to the comment, ending at its anchor
  // line — shown where the full diff isn't (the Overview's conversation).
  diffHunk: string;
}

// What the composer sends when opening a new inline comment thread.
export interface NewReviewComment {
  // The head commit the rendered diff belongs to (GitHub's commit_id).
  commitId: string;
  path: string;
  side: DiffSide;
  line: number;
  // Set when the comment covers a range ending at `line`.
  startLine: number | null;
  body: string;
}

export interface PullRequestCommit {
  sha: string;
  subject: string;
  author: string;
  date: string;
}

export type FileStatus = "added" | "modified" | "deleted" | "renamed";

export interface PullRequestFile {
  path: string;
  previousPath: string | null;
  status: FileStatus;
  additions: number;
  deletions: number;
  patch: string | null;
}

// "attention" = changed logic worth careful thought, "routine" = ordinary
// changes, "mechanical" = renames/lockfiles/generated code — skimmable.
export type ChangeGroupRisk = "attention" | "routine" | "mechanical";

// Points a claim at the exact place in the diff it's based on. `line` is a
// line number in the new version of the file; null means the whole file.
export interface DiffAnchor {
  path: string;
  line: number | null;
}

export interface ChangeGroup {
  id: string;
  title: string;
  story: string;
  risk: ChangeGroupRisk;
  files: string[];
}

export interface AnalysisClaim {
  title: string;
  text: string;
  anchors: DiffAnchor[];
}

// How serious a risk would be if it turns out to be real.
export type RiskSeverity = "low" | "medium" | "high";

export interface RiskClaim extends AnalysisClaim {
  // Optional: analyses cached before severity classification existed lack it.
  severity?: RiskSeverity;
}

export interface AnalysisUsage {
  inputTokens: number;
  outputTokens: number;
  // Absent when the analysis ran on a Claude plan — there's no per-token price.
  costUsd?: number;
}

export interface AnalysisResult {
  repo: string;
  prNumber: number;
  headSha: string;
  model: string;
  analyzedAt: string;
  // Optional: analyses cached before cost tracking existed don't have it.
  usage?: AnalysisUsage;
  summary: string;
  groups: ChangeGroup[];
  risks: RiskClaim[];
  behaviorChanges: AnalysisClaim[];
  outOfScope: string[];
}

// A pointer to a cached analysis — just enough to look up the PR it belongs
// to. One entry per PR (the newest analysis wins), newest first.
export interface AnalyzedPullRequest {
  repo: string;
  prNumber: number;
  headSha: string;
  analyzedAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// How the app talks to Claude: through the local Claude Code login (bills to
// the user's Claude plan) or directly with an API key (bills per token).
export type LlmProvider = "claude-code" | "api-key";

// "auto" prefers Claude Code when it's logged in, else falls back to the key.
export type LlmProviderChoice = "auto" | LlmProvider;

export interface ClaudeCodeStatus {
  available: boolean;
  // The logged-in account's email, when Claude Code exposes it.
  account: string | null;
}

// The two model-driven features, each with its own model setting.
export type LlmTask = "analysis" | "chat";

export interface LlmStatus {
  choice: LlmProviderChoice;
  effective: LlmProvider;
  claudeCode: ClaudeCodeStatus;
  apiKeyConfigured: boolean;
  models: Record<LlmTask, string>;
}

export type SecretProvider = "anthropic" | "github";

export type SecretsStatus = Record<SecretProvider, boolean>;

export interface KeyTestResult {
  ok: boolean;
  message: string;
}
