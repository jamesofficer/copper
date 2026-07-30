import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import {
  type ChatChunk,
  chatChunkChannel,
  type WindowApi,
} from "../shared/ipc";

const api: WindowApi = {
  listRepositories: () => ipcRenderer.invoke("listRepositories"),
  addRepository: () => ipcRenderer.invoke("addRepository"),
  removeRepository: (path) => ipcRenderer.invoke("removeRepository", path),
  reorderRepositories: (paths) =>
    ipcRenderer.invoke("reorderRepositories", paths),
  listPullRequests: (repo) => ipcRenderer.invoke("listPullRequests", repo),
  listReviewRequestedPullRequests: () =>
    ipcRenderer.invoke("listReviewRequestedPullRequests"),
  listMyPullRequests: () => ipcRenderer.invoke("listMyPullRequests"),
  getOpenPullRequestCounts: () =>
    ipcRenderer.invoke("getOpenPullRequestCounts"),
  getBranchInfo: (repo) => ipcRenderer.invoke("getBranchInfo", repo),
  createPullRequest: (repo, pr) =>
    ipcRenderer.invoke("createPullRequest", repo, pr),
  getPullRequest: (repo, prNumber) =>
    ipcRenderer.invoke("getPullRequest", repo, prNumber),
  getReviewDecision: (repo, prNumber) =>
    ipcRenderer.invoke("getReviewDecision", repo, prNumber),
  setPullRequestState: (repo, prNumber, state) =>
    ipcRenderer.invoke("setPullRequestState", repo, prNumber, state),
  setPullRequestReady: (repo, prNumber) =>
    ipcRenderer.invoke("setPullRequestReady", repo, prNumber),
  setPullRequestBase: (repo, prNumber, base) =>
    ipcRenderer.invoke("setPullRequestBase", repo, prNumber, base),
  setPullRequestBody: (repo, prNumber, body) =>
    ipcRenderer.invoke("setPullRequestBody", repo, prNumber, body),
  removeReviewRequest: (repo, prNumber) =>
    ipcRenderer.invoke("removeReviewRequest", repo, prNumber),
  peekPullRequest: (repo, prNumber) =>
    ipcRenderer.invoke("peekPullRequest", repo, prNumber),
  peekPullRequestActivity: (repo, prNumber) =>
    ipcRenderer.invoke("peekPullRequestActivity", repo, prNumber),
  listPullRequestFiles: (repo, prNumber) =>
    ipcRenderer.invoke("listPullRequestFiles", repo, prNumber),
  listPullRequestCommits: (repo, prNumber) =>
    ipcRenderer.invoke("listPullRequestCommits", repo, prNumber),
  listCommitFiles: (repo, commitSha) =>
    ipcRenderer.invoke("listCommitFiles", repo, commitSha),
  getFileAtCommit: (repo, sha, path) =>
    ipcRenderer.invoke("getFileAtCommit", repo, sha, path),
  listPullRequestComments: (repo, prNumber) =>
    ipcRenderer.invoke("listPullRequestComments", repo, prNumber),
  listPullRequestReviews: (repo, prNumber) =>
    ipcRenderer.invoke("listPullRequestReviews", repo, prNumber),
  addPullRequestComment: (repo, prNumber, body) =>
    ipcRenderer.invoke("addPullRequestComment", repo, prNumber, body),
  listReviewComments: (repo, prNumber) =>
    ipcRenderer.invoke("listReviewComments", repo, prNumber),
  addReviewComment: (repo, prNumber, comment) =>
    ipcRenderer.invoke("addReviewComment", repo, prNumber, comment),
  replyToReviewComment: (repo, prNumber, commentId, body) =>
    ipcRenderer.invoke("replyToReviewComment", repo, prNumber, commentId, body),
  deleteReviewComment: (repo, commentId) =>
    ipcRenderer.invoke("deleteReviewComment", repo, commentId),
  listReactions: (repo, prNumber) =>
    ipcRenderer.invoke("listReactions", repo, prNumber),
  setReaction: (commentNodeId, content, reacted) =>
    ipcRenderer.invoke("setReaction", commentNodeId, content, reacted),
  listResolvedReviewThreads: (repo, prNumber) =>
    ipcRenderer.invoke("listResolvedReviewThreads", repo, prNumber),
  setReviewThreadResolved: (repo, prNumber, rootCommentId, resolved) =>
    ipcRenderer.invoke(
      "setReviewThreadResolved",
      repo,
      prNumber,
      rootCommentId,
      resolved,
    ),
  listDraftComments: (repo, prNumber) =>
    ipcRenderer.invoke("listDraftComments", repo, prNumber),
  addDraftComment: (repo, prNumber, comment) =>
    ipcRenderer.invoke("addDraftComment", repo, prNumber, comment),
  updateDraftComment: (repo, prNumber, draftId, body) =>
    ipcRenderer.invoke("updateDraftComment", repo, prNumber, draftId, body),
  deleteDraftComment: (repo, prNumber, draftId) =>
    ipcRenderer.invoke("deleteDraftComment", repo, prNumber, draftId),
  listViewedFiles: (repo, prNumber) =>
    ipcRenderer.invoke("listViewedFiles", repo, prNumber),
  setFileViewed: (repo, prNumber, path, viewed) =>
    ipcRenderer.invoke("setFileViewed", repo, prNumber, path, viewed),
  getViewer: () => ipcRenderer.invoke("getViewer"),
  getAnalysis: (repo, prNumber) =>
    ipcRenderer.invoke("getAnalysis", repo, prNumber),
  getFindings: (repo, prNumber) =>
    ipcRenderer.invoke("getFindings", repo, prNumber),
  findIssues: (repo, prNumber, force) =>
    ipcRenderer.invoke("findIssues", repo, prNumber, force),
  setFindingResolution: (repo, prNumber, findingId, resolution) =>
    ipcRenderer.invoke(
      "setFindingResolution",
      repo,
      prNumber,
      findingId,
      resolution,
    ),
  listExplanations: (repo, prNumber) =>
    ipcRenderer.invoke("listExplanations", repo, prNumber),
  explainSelection: (repo, prNumber, request) =>
    ipcRenderer.invoke("explainSelection", repo, prNumber, request),
  deleteExplanation: (repo, prNumber, explanationId) =>
    ipcRenderer.invoke("deleteExplanation", repo, prNumber, explanationId),
  listAnalyzedPullRequests: () =>
    ipcRenderer.invoke("listAnalyzedPullRequests"),
  deleteAnalyses: (repo, prNumber) =>
    ipcRenderer.invoke("deleteAnalyses", repo, prNumber),
  analyzePullRequest: (repo, prNumber, personality, force) =>
    ipcRenderer.invoke(
      "analyzePullRequest",
      repo,
      prNumber,
      personality,
      force,
    ),
  askQuestion: (repo, prNumber, question) =>
    ipcRenderer.invoke("askQuestion", repo, prNumber, question),
  getChatHistory: (repo, prNumber) =>
    ipcRenderer.invoke("getChatHistory", repo, prNumber),
  clearChat: (repo, prNumber) =>
    ipcRenderer.invoke("clearChat", repo, prNumber),
  submitReview: (repo, prNumber, verdict, body) =>
    ipcRenderer.invoke("submitReview", repo, prNumber, verdict, body),
  getRepoMergeSettings: (repo) =>
    ipcRenderer.invoke("getRepoMergeSettings", repo),
  mergePullRequest: (repo, prNumber, method) =>
    ipcRenderer.invoke("mergePullRequest", repo, prNumber, method),
  getLlmStatus: () => ipcRenderer.invoke("getLlmStatus"),
  setLlmProvider: (choice) => ipcRenderer.invoke("setLlmProvider", choice),
  setLlmModel: (task, model) => ipcRenderer.invoke("setLlmModel", task, model),
  getSecretsStatus: () => ipcRenderer.invoke("getSecretsStatus"),
  saveSecret: (provider, value) =>
    ipcRenderer.invoke("saveSecret", provider, value),
  clearSecret: (provider) => ipcRenderer.invoke("clearSecret", provider),
  onChatChunk: (listener) => {
    const handler = (_event: IpcRendererEvent, chunk: ChatChunk) =>
      listener(chunk);
    ipcRenderer.on(chatChunkChannel, handler);
    return () => ipcRenderer.off(chatChunkChannel, handler);
  },
};

contextBridge.exposeInMainWorld("api", api);
