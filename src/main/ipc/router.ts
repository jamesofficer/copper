import { ipcMain } from 'electron'
import type { IpcApi } from '../../shared/ipc'
import { listReviewRequests } from '../github/client'
import { addRepository, listRepositories, removeRepository } from '../repo/local'
import { analyzePullRequest } from '../analysis/pipeline'
import { askQuestion } from '../agent/session'

const handlers: IpcApi = {
  listRepositories: () => listRepositories(),
  addRepository: () => addRepository(),
  removeRepository: (path) => removeRepository(path),
  listPullRequests: (repo) => listReviewRequests(repo),
  openPullRequest: (repo, prNumber) => analyzePullRequest(repo, prNumber),
  askQuestion: (repo, prNumber, question) => askQuestion(repo, prNumber, question)
}

export function registerIpcHandlers(): void {
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (_event, ...args) =>
      (handler as (...handlerArgs: unknown[]) => unknown)(...args)
    )
  }
}
