import type {
  AnalysisResult,
  ChatMessage,
  KeyTestResult,
  PullRequest,
  PullRequestDetail,
  PullRequestFile,
  Repository,
  ReviewVerdict,
  SecretProvider,
  SecretsStatus,
} from "./types";

export interface IpcApi {
  listRepositories(): Promise<Repository[]>;
  addRepository(): Promise<Repository | null>;
  removeRepository(path: string): Promise<Repository[]>;
  listPullRequests(repo: string): Promise<PullRequest[]>;
  getPullRequest(repo: string, prNumber: number): Promise<PullRequestDetail>;
  // Same data as getPullRequest but without the background repo warm-up —
  // for bulk refreshes (e.g. the recently-viewed panel).
  peekPullRequest(repo: string, prNumber: number): Promise<PullRequestDetail>;
  listPullRequestFiles(
    repo: string,
    prNumber: number,
  ): Promise<PullRequestFile[]>;
  getAnalysis(repo: string, prNumber: number): Promise<AnalysisResult | null>;
  analyzePullRequest(repo: string, prNumber: number): Promise<AnalysisResult>;
  askQuestion(
    repo: string,
    prNumber: number,
    question: string,
  ): Promise<string>;
  getChatHistory(repo: string, prNumber: number): Promise<ChatMessage[]>;
  submitReview(
    repo: string,
    prNumber: number,
    verdict: ReviewVerdict,
    body: string,
  ): Promise<void>;
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
  "getPullRequest",
  "peekPullRequest",
  "listPullRequestFiles",
  "getAnalysis",
  "analyzePullRequest",
  "askQuestion",
  "getChatHistory",
  "submitReview",
  "getSecretsStatus",
  "saveSecret",
  "clearSecret",
] as const satisfies readonly (keyof IpcApi)[];
