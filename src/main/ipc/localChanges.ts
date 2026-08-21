import type { IpcApi } from "../../shared/ipc";
import {
  commitChanges,
  discardChanges,
  getLocalChangeCount,
  getLocalChanges,
  stageFiles,
  unstageFiles,
} from "../repo/changes";
import {
  getLocalCommitFiles,
  listLocalCommits,
  pushLocalBranch,
} from "../repo/commits";
import { listRepositories, listWorktrees } from "../repo/local";

type LocalChangesHandlers = Pick<
  IpcApi,
  | "getLocalChangeCount"
  | "getLocalChanges"
  | "listLocalCommits"
  | "getLocalCommitFiles"
  | "listWorktrees"
  | "stageFiles"
  | "unstageFiles"
  | "discardChanges"
  | "commitChanges"
  | "pushLocalBranch"
>;

interface LocalChangesDependencies {
  listRepositories: typeof listRepositories;
  listWorktrees: typeof listWorktrees;
  getLocalChangeCount: typeof getLocalChangeCount;
  getLocalChanges: typeof getLocalChanges;
  listLocalCommits: typeof listLocalCommits;
  getLocalCommitFiles: typeof getLocalCommitFiles;
  stageFiles: typeof stageFiles;
  unstageFiles: typeof unstageFiles;
  discardChanges: typeof discardChanges;
  commitChanges: typeof commitChanges;
  pushLocalBranch: typeof pushLocalBranch;
}

export function createLocalChangesHandlers(
  dependencies: LocalChangesDependencies,
): LocalChangesHandlers {
  // Git uses one index lock per checkout. Keep writes in invocation order.
  // A commit must follow its stage operation, and a push must follow its commit.
  const pendingWrites = new Map<string, Promise<void>>();

  function serializeMutation<T>(
    repoPath: string,
    mutation: () => Promise<T>,
  ): Promise<T> {
    const previous = pendingWrites.get(repoPath) ?? Promise.resolve();
    const result = previous.then(mutation);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    pendingWrites.set(repoPath, tail);
    void tail.finally(() => {
      if (pendingWrites.get(repoPath) === tail) pendingWrites.delete(repoPath);
    });
    return result;
  }

  async function assertRegisteredCheckout(repoPath: string): Promise<void> {
    const repositories = await dependencies.listRepositories();
    if (repositories.some((repository) => repository.path === repoPath)) return;

    const worktrees = await Promise.all(
      repositories.map((repository) =>
        dependencies.listWorktrees(repository.path),
      ),
    );
    if (
      worktrees.some((entries) =>
        entries.some((tree) => tree.path === repoPath),
      )
    ) {
      return;
    }
    throw new Error("That checkout is not part of a registered repository.");
  }

  return {
    getLocalChangeCount: (repoPath) =>
      dependencies.getLocalChangeCount(repoPath),
    getLocalChanges: (repoPath) => dependencies.getLocalChanges(repoPath),
    listLocalCommits: (repoPath) => dependencies.listLocalCommits(repoPath),
    getLocalCommitFiles: (repoPath, sha) =>
      dependencies.getLocalCommitFiles(repoPath, sha),
    listWorktrees: (repoPath) => dependencies.listWorktrees(repoPath),
    stageFiles: (repoPath, paths) =>
      serializeMutation(repoPath, async () => {
        await assertRegisteredCheckout(repoPath);
        return dependencies.stageFiles(repoPath, paths);
      }),
    unstageFiles: (repoPath, paths) =>
      serializeMutation(repoPath, async () => {
        await assertRegisteredCheckout(repoPath);
        return dependencies.unstageFiles(repoPath, paths);
      }),
    discardChanges: (repoPath, paths) =>
      serializeMutation(repoPath, async () => {
        await assertRegisteredCheckout(repoPath);
        return dependencies.discardChanges(repoPath, paths);
      }),
    commitChanges: (repoPath, message) =>
      serializeMutation(repoPath, async () => {
        await assertRegisteredCheckout(repoPath);
        return dependencies.commitChanges(repoPath, message);
      }),
    pushLocalBranch: (repoPath) =>
      serializeMutation(repoPath, async () => {
        await assertRegisteredCheckout(repoPath);
        return dependencies.pushLocalBranch(repoPath);
      }),
  };
}

export const localChangesHandlers = createLocalChangesHandlers({
  listRepositories,
  listWorktrees,
  getLocalChangeCount,
  getLocalChanges,
  listLocalCommits,
  getLocalCommitFiles,
  stageFiles,
  unstageFiles,
  discardChanges,
  commitChanges,
  pushLocalBranch,
});
