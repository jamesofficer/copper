import type {
  AnalysisResult,
  AnalyzedPullRequest,
  ChatMessage,
  KeyTestResult,
  LlmProviderChoice,
  LlmStatus,
  LlmTask,
  MergeMethod,
  NewReviewComment,
  PullRequest,
  PullRequestComment,
  PullRequestCommit,
  PullRequestDetail,
  PullRequestFile,
  PullRequestReview,
  Repository,
  ReviewComment,
  ReviewPersonality,
  ReviewVerdict,
  SecretProvider,
  SecretsStatus,
} from "./types";

export interface IpcApi {
  listRepositories(): Promise<Repository[]>;
  addRepository(): Promise<Repository | null>;
  removeRepository(path: string): Promise<Repository[]>;
  listPullRequests(repo: string): Promise<PullRequest[]>;
  // Open PRs (any repo) where the logged-in user's review is requested.
  listReviewRequestedPullRequests(): Promise<PullRequest[]>;
  getPullRequest(repo: string, prNumber: number): Promise<PullRequestDetail>;
  // Same data as getPullRequest but without the background repo warm-up —
  // for bulk refreshes (e.g. the recently-viewed panel).
  peekPullRequest(repo: string, prNumber: number): Promise<PullRequestDetail>;
  listPullRequestFiles(
    repo: string,
    prNumber: number,
  ): Promise<PullRequestFile[]>;
  listPullRequestCommits(
    repo: string,
    prNumber: number,
  ): Promise<PullRequestCommit[]>;
  listCommitFiles(repo: string, commitSha: string): Promise<PullRequestFile[]>;
  listPullRequestComments(
    repo: string,
    prNumber: number,
  ): Promise<PullRequestComment[]>;
  listPullRequestReviews(
    repo: string,
    prNumber: number,
  ): Promise<PullRequestReview[]>;
  addPullRequestComment(
    repo: string,
    prNumber: number,
    body: string,
  ): Promise<PullRequestComment>;
  // Inline review comments on diff lines — separate from the conversation
  // comments above.
  listReviewComments(repo: string, prNumber: number): Promise<ReviewComment[]>;
  addReviewComment(
    repo: string,
    prNumber: number,
    comment: NewReviewComment,
  ): Promise<ReviewComment>;
  replyToReviewComment(
    repo: string,
    prNumber: number,
    commentId: number,
    body: string,
  ): Promise<ReviewComment>;
  deleteReviewComment(repo: string, commentId: number): Promise<void>;
  // The GitHub login the stored token belongs to.
  getViewer(): Promise<string>;
  getAnalysis(repo: string, prNumber: number): Promise<AnalysisResult | null>;
  listAnalyzedPullRequests(): Promise<AnalyzedPullRequest[]>;
  analyzePullRequest(
    repo: string,
    prNumber: number,
    personality: ReviewPersonality,
    force?: boolean,
  ): Promise<AnalysisResult>;
  askQuestion(
    repo: string,
    prNumber: number,
    question: string,
  ): Promise<string>;
  getChatHistory(repo: string, prNumber: number): Promise<ChatMessage[]>;
  clearChat(repo: string, prNumber: number): Promise<void>;
  submitReview(
    repo: string,
    prNumber: number,
    verdict: ReviewVerdict,
    body: string,
  ): Promise<void>;
  mergePullRequest(
    repo: string,
    prNumber: number,
    method: MergeMethod,
  ): Promise<void>;
  getLlmStatus(): Promise<LlmStatus>;
  setLlmProvider(choice: LlmProviderChoice): Promise<LlmStatus>;
  setLlmModel(task: LlmTask, model: string): Promise<LlmStatus>;
  getSecretsStatus(): Promise<SecretsStatus>;
  saveSecret(provider: SecretProvider, value: string): Promise<KeyTestResult>;
  clearSecret(provider: SecretProvider): Promise<SecretsStatus>;
}

// Streaming chat answers are pushed main → renderer as deltas, outside the
// invoke/handle pattern above. askQuestion still resolves with the full text.
export interface ChatChunk {
  repo: string;
  prNumber: number;
  text: string;
}

export const chatChunkChannel = "chatChunk";

export interface RendererEvents {
  onChatChunk(listener: (chunk: ChatChunk) => void): () => void;
}

export type WindowApi = IpcApi & RendererEvents;

export const ipcChannels = [
  "listRepositories",
  "addRepository",
  "removeRepository",
  "listPullRequests",
  "listReviewRequestedPullRequests",
  "getPullRequest",
  "peekPullRequest",
  "listPullRequestFiles",
  "listPullRequestCommits",
  "listCommitFiles",
  "listPullRequestComments",
  "listPullRequestReviews",
  "addPullRequestComment",
  "listReviewComments",
  "addReviewComment",
  "replyToReviewComment",
  "deleteReviewComment",
  "getViewer",
  "getAnalysis",
  "listAnalyzedPullRequests",
  "analyzePullRequest",
  "askQuestion",
  "getChatHistory",
  "clearChat",
  "submitReview",
  "mergePullRequest",
  "getLlmStatus",
  "setLlmProvider",
  "setLlmModel",
  "getSecretsStatus",
  "saveSecret",
  "clearSecret",
] as const satisfies readonly (keyof IpcApi)[];
