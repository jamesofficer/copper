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
  listPullRequests: (repo) => ipcRenderer.invoke("listPullRequests", repo),
  listReviewRequestedPullRequests: () =>
    ipcRenderer.invoke("listReviewRequestedPullRequests"),
  getPullRequest: (repo, prNumber) =>
    ipcRenderer.invoke("getPullRequest", repo, prNumber),
  peekPullRequest: (repo, prNumber) =>
    ipcRenderer.invoke("peekPullRequest", repo, prNumber),
  listPullRequestFiles: (repo, prNumber) =>
    ipcRenderer.invoke("listPullRequestFiles", repo, prNumber),
  listPullRequestCommits: (repo, prNumber) =>
    ipcRenderer.invoke("listPullRequestCommits", repo, prNumber),
  listCommitFiles: (repo, commitSha) =>
    ipcRenderer.invoke("listCommitFiles", repo, commitSha),
  listPullRequestComments: (repo, prNumber) =>
    ipcRenderer.invoke("listPullRequestComments", repo, prNumber),
  listPullRequestReviews: (repo, prNumber) =>
    ipcRenderer.invoke("listPullRequestReviews", repo, prNumber),
  addPullRequestComment: (repo, prNumber, body) =>
    ipcRenderer.invoke("addPullRequestComment", repo, prNumber, body),
  getAnalysis: (repo, prNumber) =>
    ipcRenderer.invoke("getAnalysis", repo, prNumber),
  listAnalyzedPullRequests: () =>
    ipcRenderer.invoke("listAnalyzedPullRequests"),
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
