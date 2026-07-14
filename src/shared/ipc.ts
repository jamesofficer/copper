import type { AnalysisResult, PullRequest, Repository } from "./types";

export interface IpcApi {
  listRepositories(): Promise<Repository[]>;
  addRepository(): Promise<Repository | null>;
  removeRepository(path: string): Promise<Repository[]>;
  listPullRequests(repo: string): Promise<PullRequest[]>;
  openPullRequest(repo: string, prNumber: number): Promise<AnalysisResult>;
  askQuestion(
    repo: string,
    prNumber: number,
    question: string,
  ): Promise<string>;
}

export const ipcChannels = [
  "listRepositories",
  "addRepository",
  "removeRepository",
  "listPullRequests",
  "openPullRequest",
  "askQuestion",
] as const satisfies readonly (keyof IpcApi)[];
