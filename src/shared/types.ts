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
  headSha: string;
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
  text: string;
  anchors: DiffAnchor[];
}

export interface AnalysisResult {
  repo: string;
  prNumber: number;
  headSha: string;
  model: string;
  analyzedAt: string;
  summary: string;
  groups: ChangeGroup[];
  risks: AnalysisClaim[];
  behaviorChanges: AnalysisClaim[];
  outOfScope: string[];
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
