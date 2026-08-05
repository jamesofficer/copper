import { ipcMain } from "electron";
import type { IpcApi } from "../../shared/ipc";
import {
  askQuestion,
  clearChat,
  explainSelection,
  getChatHistory,
} from "../agent/session";
import { deleteAnalyses, listAnalyzedPullRequests } from "../analysis/cache";
import { findIssues, getExistingFindings } from "../analysis/findings";
import { analyzePullRequest, getExistingAnalysis } from "../analysis/pipeline";
import {
  getAttachmentAuthStatus,
  signInForAttachments,
  signOutOfAttachments,
  uploadAttachment,
} from "../github/attachments";
import {
  addPullRequestComment,
  addReviewComment,
  createPullRequest,
  deleteReviewComment,
  getBranchInfo,
  getOpenPullRequestCounts,
  getPullRequest,
  getRepoMergeSettings,
  getReviewDecision,
  getViewer,
  listCommitFiles,
  listMyPullRequests,
  listPullRequestComments,
  listPullRequestCommits,
  listPullRequestFiles,
  listPullRequestReviews,
  listReactions,
  listResolvedReviewThreads,
  listReviewComments,
  listReviewRequestedPullRequests,
  listReviewRequests,
  listViewedFiles,
  mergePullRequest,
  peekPullRequestActivity,
  removeReviewRequest,
  replyToReviewComment,
  setFileViewed,
  setPullRequestBase,
  setPullRequestBody,
  setPullRequestReady,
  setPullRequestState,
  setReaction,
  setReviewThreadResolved,
  submitReview,
} from "../github/client";
import { getLlmStatus, setLlmModel, setLlmProvider } from "../llm/settings";
import {
  commitChanges,
  getLocalChanges,
  stageFiles,
  unstageFiles,
} from "../repo/changes";
import {
  addRepository,
  listRepositories,
  listWorktrees,
  removeRepository,
  reorderRepositories,
} from "../repo/local";
import { readFileAtCommit, warmUpPullRequest } from "../repo/workspace";
import { clearKey, getKeyStatus, saveKey } from "../settings/keys";
import {
  addDraftComment,
  deleteDraftComment,
  listDraftComments,
  updateDraftComment,
} from "../store/drafts";
import { deleteExplanation, listExplanations } from "../store/explanations";
import { setFindingResolution } from "../store/findings";

const handlers: IpcApi = {
  listRepositories: () => listRepositories(),
  addRepository: () => addRepository(),
  removeRepository: (path) => removeRepository(path),
  reorderRepositories: (paths) => reorderRepositories(paths),
  getLocalChanges: (repoPath) => getLocalChanges(repoPath),
  listWorktrees: (repoPath) => listWorktrees(repoPath),
  stageFiles: (repoPath, paths) => stageFiles(repoPath, paths),
  unstageFiles: (repoPath, paths) => unstageFiles(repoPath, paths),
  commitChanges: (repoPath, message) => commitChanges(repoPath, message),
  listPullRequests: (repo) => listReviewRequests(repo),
  listReviewRequestedPullRequests: () => listReviewRequestedPullRequests(),
  listMyPullRequests: () => listMyPullRequests(),
  getOpenPullRequestCounts: () => getOpenPullRequestCounts(),
  getBranchInfo: (repo) => getBranchInfo(repo),
  createPullRequest: (repo, pr) => createPullRequest(repo, pr),
  getPullRequest: async (repo, prNumber) => {
    const detail = await getPullRequest(repo, prNumber);
    // Best-effort background clone/fetch so repo context is ready for the chat.
    void warmUpPullRequest(repo, prNumber, detail.headSha);
    return detail;
  },
  getReviewDecision: (repo, prNumber) => getReviewDecision(repo, prNumber),
  setPullRequestState: (repo, prNumber, state) =>
    setPullRequestState(repo, prNumber, state),
  setPullRequestReady: (repo, prNumber) => setPullRequestReady(repo, prNumber),
  setPullRequestBase: (repo, prNumber, base) =>
    setPullRequestBase(repo, prNumber, base),
  setPullRequestBody: (repo, prNumber, body) =>
    setPullRequestBody(repo, prNumber, body),
  removeReviewRequest: (repo, prNumber) => removeReviewRequest(repo, prNumber),
  peekPullRequest: (repo, prNumber) => getPullRequest(repo, prNumber),
  peekPullRequestActivity: (repo, prNumber) =>
    peekPullRequestActivity(repo, prNumber),
  listPullRequestFiles: (repo, prNumber) =>
    listPullRequestFiles(repo, prNumber),
  listPullRequestCommits: (repo, prNumber) =>
    listPullRequestCommits(repo, prNumber),
  listCommitFiles: (repo, commitSha) => listCommitFiles(repo, commitSha),
  getFileAtCommit: (repo, sha, path) => readFileAtCommit(repo, sha, path),
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
  listReactions: (repo, prNumber) => listReactions(repo, prNumber),
  setReaction: (commentNodeId, content, reacted) =>
    setReaction(commentNodeId, content, reacted),
  listResolvedReviewThreads: (repo, prNumber) =>
    listResolvedReviewThreads(repo, prNumber),
  setReviewThreadResolved: (repo, prNumber, rootCommentId, resolved) =>
    setReviewThreadResolved(repo, prNumber, rootCommentId, resolved),
  listDraftComments: (repo, prNumber) => listDraftComments(repo, prNumber),
  addDraftComment: (repo, prNumber, comment) =>
    addDraftComment(repo, prNumber, comment),
  updateDraftComment: (repo, prNumber, draftId, body) =>
    updateDraftComment(repo, prNumber, draftId, body),
  deleteDraftComment: (repo, prNumber, draftId) =>
    deleteDraftComment(repo, prNumber, draftId),
  listViewedFiles: (repo, prNumber) => listViewedFiles(repo, prNumber),
  setFileViewed: (repo, prNumber, path, viewed) =>
    setFileViewed(repo, prNumber, path, viewed),
  getViewer: () => getViewer(),
  getAttachmentAuthStatus: () => getAttachmentAuthStatus(),
  signInForAttachments: () => signInForAttachments(),
  signOutOfAttachments: () => signOutOfAttachments(),
  uploadAttachment: (repo, prNumber, file) =>
    uploadAttachment(repo, prNumber, file),
  getAnalysis: (repo, prNumber) => getExistingAnalysis(repo, prNumber),
  getFindings: (repo, prNumber) => getExistingFindings(repo, prNumber),
  findIssues: (repo, prNumber, force) => findIssues(repo, prNumber, force),
  setFindingResolution: (repo, prNumber, findingId, resolution) =>
    setFindingResolution(repo, prNumber, findingId, resolution),
  listExplanations: (repo, prNumber) => listExplanations(repo, prNumber),
  explainSelection: (repo, prNumber, request) =>
    explainSelection(repo, prNumber, request),
  deleteExplanation: (repo, prNumber, explanationId) =>
    deleteExplanation(repo, prNumber, explanationId),
  listAnalyzedPullRequests: () => listAnalyzedPullRequests(),
  deleteAnalyses: (repo, prNumber) => deleteAnalyses(repo, prNumber),
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
