import { contextBridge, ipcRenderer } from "electron";
import type { IpcApi } from "../shared/ipc";

const api: IpcApi = {
  listRepositories: () => ipcRenderer.invoke("listRepositories"),
  addRepository: () => ipcRenderer.invoke("addRepository"),
  removeRepository: (path) => ipcRenderer.invoke("removeRepository", path),
  listPullRequests: (repo) => ipcRenderer.invoke("listPullRequests", repo),
  getPullRequest: (repo, prNumber) =>
    ipcRenderer.invoke("getPullRequest", repo, prNumber),
  listPullRequestFiles: (repo, prNumber) =>
    ipcRenderer.invoke("listPullRequestFiles", repo, prNumber),
  openPullRequest: (repo, prNumber) =>
    ipcRenderer.invoke("openPullRequest", repo, prNumber),
  askQuestion: (repo, prNumber, question) =>
    ipcRenderer.invoke("askQuestion", repo, prNumber, question),
  getSecretsStatus: () => ipcRenderer.invoke("getSecretsStatus"),
  saveSecret: (provider, value) =>
    ipcRenderer.invoke("saveSecret", provider, value),
  clearSecret: (provider) => ipcRenderer.invoke("clearSecret", provider),
};

contextBridge.exposeInMainWorld("api", api);
