import type {
  AnalysisResult,
  KeyTestResult,
  PullRequest,
  PullRequestDetail,
  PullRequestFile,
  Repository,
  SecretProvider,
  SecretsStatus,
} from "./types";

export interface IpcApi {
  listRepositories(): Promise<Repository[]>;
  addRepository(): Promise<Repository | null>;
  removeRepository(path: string): Promise<Repository[]>;
  listPullRequests(repo: string): Promise<PullRequest[]>;
  getPullRequest(repo: string, prNumber: number): Promise<PullRequestDetail>;
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
  getSecretsStatus(): Promise<SecretsStatus>;
  saveSecret(provider: SecretProvider, value: string): Promise<KeyTestResult>;
  clearSecret(provider: SecretProvider): Promise<SecretsStatus>;
}

export const ipcChannels = [
  "listRepositories",
  "addRepository",
  "removeRepository",
  "listPullRequests",
  "getPullRequest",
  "listPullRequestFiles",
  "getAnalysis",
  "analyzePullRequest",
  "askQuestion",
  "getSecretsStatus",
  "saveSecret",
  "clearSecret",
] as const satisfies readonly (keyof IpcApi)[];
