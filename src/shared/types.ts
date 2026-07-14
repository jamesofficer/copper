export interface Repository {
  path: string;
  name: string;
  slug: string | null;
}

export interface PullRequest {
  repo: string;
  number: number;
  title: string;
  author: string;
  headSha: string;
  url: string;
  additions: number;
  deletions: number;
  changedFiles: number;
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
  baseRef: string;
  headRef: string;
  labels: PullRequestLabel[];
  reviewers: string[];
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
  createdAt: string;
  updatedAt: string;
  url: string;
}

export type FileStatus = "added" | "modified" | "deleted" | "renamed";

export interface ChangedFile {
  path: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  mechanical: boolean;
}

export interface PullRequestFile {
  path: string;
  previousPath: string | null;
  status: FileStatus;
  additions: number;
  deletions: number;
  patch: string | null;
}

export type Risk = "low" | "medium" | "high";

export interface ChangeGroup {
  id: string;
  title: string;
  why: string;
  files: string[];
  risk: Risk;
  mechanical: boolean;
}

export interface SummaryLenses {
  overview: string;
  risks: string;
  behavior: string;
  scope: string;
}

export interface AnalysisResult {
  repo: string;
  prNumber: number;
  headSha: string;
  files: ChangedFile[];
  groups: ChangeGroup[];
  readingOrder: string[];
  summaries: SummaryLenses | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type SecretProvider = "anthropic" | "github";

export type SecretsStatus = Record<SecretProvider, boolean>;

export interface KeyTestResult {
  ok: boolean;
  message: string;
}
