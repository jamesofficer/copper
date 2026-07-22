import { ipcMain } from "electron";
import type { IpcApi } from "../../shared/ipc";
import { askQuestion, clearChat, getChatHistory } from "../agent/session";
import { listAnalyzedPullRequests } from "../analysis/cache";
import { analyzePullRequest, getExistingAnalysis } from "../analysis/pipeline";
import {
  addPullRequestComment,
  addReviewComment,
  createPullRequest,
  deleteReviewComment,
  getBranchInfo,
  getPullRequest,
  getRepoMergeSettings,
  getViewer,
  listCommitFiles,
  listMyPullRequests,
  listPullRequestComments,
  listPullRequestCommits,
  listPullRequestFiles,
  listPullRequestReviews,
  listResolvedReviewThreads,
  listReviewComments,
  listReviewRequestedPullRequests,
  listReviewRequests,
  mergePullRequest,
  replyToReviewComment,
  setReviewThreadResolved,
  submitReview,
} from "../github/client";
import { getLlmStatus, setLlmModel, setLlmProvider } from "../llm/settings";
import {
  addRepository,
  listRepositories,
  removeRepository,
  reorderRepositories,
} from "../repo/local";
import { warmUpPullRequest } from "../repo/workspace";
import { clearKey, getKeyStatus, saveKey } from "../settings/keys";

const handlers: IpcApi = {
  listRepositories: () => listRepositories(),
  addRepository: () => addRepository(),
  removeRepository: (path) => removeRepository(path),
  reorderRepositories: (paths) => reorderRepositories(paths),
  listPullRequests: (repo) => listReviewRequests(repo),
  listReviewRequestedPullRequests: () => listReviewRequestedPullRequests(),
  listMyPullRequests: () => listMyPullRequests(),
  getBranchInfo: (repo) => getBranchInfo(repo),
  createPullRequest: (repo, pr) => createPullRequest(repo, pr),
  getPullRequest: async (repo, prNumber) => {
    const detail = await getPullRequest(repo, prNumber);
    // Best-effort background clone/fetch so repo context is ready for the chat.
    void warmUpPullRequest(repo, prNumber, detail.headSha);
    return detail;
  },
  peekPullRequest: (repo, prNumber) => getPullRequest(repo, prNumber),
  listPullRequestFiles: (repo, prNumber) =>
    listPullRequestFiles(repo, prNumber),
  listPullRequestCommits: (repo, prNumber) =>
    listPullRequestCommits(repo, prNumber),
  listCommitFiles: (repo, commitSha) => listCommitFiles(repo, commitSha),
  listPullRequestComments: (repo, prNumber) =>
    listPullRequestComments(repo, prNumber),
  listPullRequestReviews: (repo, prNumber) =>
    listPullRequestReviews(repo, prNumber),
  addPullRequestComment: (repo, prNumber, body) =>
    addPullRequestComment(repo, prNumber, body),
  listReviewComments: (repo, prNumber) => listReviewComments(repo, prNumber),
  addReviewComment: (repo, prNumber, comment) =>
    addReviewComment(repo, prNumber, comment),
  replyToReviewComment: (repo, prNumber, commentId, body) =>
    replyToReviewComment(repo, prNumber, commentId, body),
  deleteReviewComment: (repo, commentId) =>
    deleteReviewComment(repo, commentId),
  listResolvedReviewThreads: (repo, prNumber) =>
    listResolvedReviewThreads(repo, prNumber),
  setReviewThreadResolved: (repo, prNumber, rootCommentId, resolved) =>
    setReviewThreadResolved(repo, prNumber, rootCommentId, resolved),
  getViewer: () => getViewer(),
  getAnalysis: (repo, prNumber) => getExistingAnalysis(repo, prNumber),
  listAnalyzedPullRequests: () => listAnalyzedPullRequests(),
  analyzePullRequest: (repo, prNumber, personality, force) =>
    analyzePullRequest(repo, prNumber, personality, force),
  askQuestion: (repo, prNumber, question) =>
    askQuestion(repo, prNumber, question),
  getChatHistory: (repo, prNumber) => getChatHistory(repo, prNumber),
  clearChat: (repo, prNumber) => clearChat(repo, prNumber),
  submitReview: (repo, prNumber, verdict, body) =>
    submitReview(repo, prNumber, verdict, body),
  getRepoMergeSettings: (repo) => getRepoMergeSettings(repo),
  mergePullRequest: (repo, prNumber, method) =>
    mergePullRequest(repo, prNumber, method),
  getLlmStatus: () => getLlmStatus(),
  setLlmProvider: (choice) => setLlmProvider(choice),
  setLlmModel: (task, model) => setLlmModel(task, model),
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
