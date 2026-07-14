import type {
  AnalysisResult,
  KeyTestResult,
  PullRequest,
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
  listPullRequestFiles(
    repo: string,
    prNumber: number,
  ): Promise<PullRequestFile[]>;
  openPullRequest(repo: string, prNumber: number): Promise<AnalysisResult>;
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
  "listPullRequestFiles",
  "openPullRequest",
  "askQuestion",
  "getSecretsStatus",
  "saveSecret",
  "clearSecret",
] as const satisfies readonly (keyof IpcApi)[];
