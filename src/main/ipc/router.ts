import { ipcMain } from "electron";
import type { IpcApi } from "../../shared/ipc";
import { askQuestion } from "../agent/session";
import { analyzePullRequest } from "../analysis/pipeline";
import {
  getPullRequest,
  listPullRequestFiles,
  listReviewRequests,
} from "../github/client";
import {
  addRepository,
  listRepositories,
  removeRepository,
} from "../repo/local";
import { clearKey, getKeyStatus, saveKey } from "../settings/keys";

const handlers: IpcApi = {
  listRepositories: () => listRepositories(),
  addRepository: () => addRepository(),
  removeRepository: (path) => removeRepository(path),
  listPullRequests: (repo) => listReviewRequests(repo),
  getPullRequest: (repo, prNumber) => getPullRequest(repo, prNumber),
  listPullRequestFiles: (repo, prNumber) =>
    listPullRequestFiles(repo, prNumber),
  openPullRequest: (repo, prNumber) => analyzePullRequest(repo, prNumber),
  askQuestion: (repo, prNumber, question) =>
    askQuestion(repo, prNumber, question),
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
