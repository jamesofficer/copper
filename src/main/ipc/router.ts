import { ipcMain } from "electron";
import type { IpcApi } from "../../shared/ipc";
import { askQuestion, getChatHistory } from "../agent/session";
import { analyzePullRequest, getExistingAnalysis } from "../analysis/pipeline";
import {
  getPullRequest,
  listPullRequestFiles,
  listReviewRequests,
  submitReview,
} from "../github/client";
import {
  addRepository,
  listRepositories,
  removeRepository,
} from "../repo/local";
import { warmUpPullRequest } from "../repo/workspace";
import { clearKey, getKeyStatus, saveKey } from "../settings/keys";

const handlers: IpcApi = {
  listRepositories: () => listRepositories(),
  addRepository: () => addRepository(),
  removeRepository: (path) => removeRepository(path),
  listPullRequests: (repo) => listReviewRequests(repo),
  getPullRequest: async (repo, prNumber) => {
    const detail = await getPullRequest(repo, prNumber);
    // Best-effort background clone/fetch so repo context is ready for the chat.
    void warmUpPullRequest(repo, prNumber, detail.headSha);
    return detail;
  },
  listPullRequestFiles: (repo, prNumber) =>
    listPullRequestFiles(repo, prNumber),
  getAnalysis: (repo, prNumber) => getExistingAnalysis(repo, prNumber),
  analyzePullRequest: (repo, prNumber) => analyzePullRequest(repo, prNumber),
  askQuestion: (repo, prNumber, question) =>
    askQuestion(repo, prNumber, question),
  getChatHistory: (repo, prNumber) => getChatHistory(repo, prNumber),
  submitReview: (repo, prNumber, verdict, body) =>
    submitReview(repo, prNumber, verdict, body),
  getSecretsStatus: () => getKeyStatus(),
  saveSecret: (provider, value) => saveKey(provider, value),
  clearSecret: (provider) => clearKey(provider),
};

export function registerIpcHandlers(): void {
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (_event, ...args) =>
      (handler as (...handlerArgs: unknown[]) => unknown)(...args),
    );
  }
}
