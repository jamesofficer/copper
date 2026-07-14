import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from '../shared/ipc'

const api: IpcApi = {
  listRepositories: () => ipcRenderer.invoke('listRepositories'),
  addRepository: () => ipcRenderer.invoke('addRepository'),
  removeRepository: (path) => ipcRenderer.invoke('removeRepository', path),
  listPullRequests: (repo) => ipcRenderer.invoke('listPullRequests', repo),
  openPullRequest: (repo, prNumber) => ipcRenderer.invoke('openPullRequest', repo, prNumber),
  askQuestion: (repo, prNumber, question) =>
    ipcRenderer.invoke('askQuestion', repo, prNumber, question)
}

contextBridge.exposeInMainWorld('api', api)
