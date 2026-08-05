import type { IpcApi } from "../../shared/ipc";
import {
  commitChanges,
  discardChanges,
  getLocalChanges,
  stageFiles,
  unstageFiles,
} from "../repo/changes";
import { listRepositories, listWorktrees } from "../repo/local";

type LocalChangesHandlers = Pick<
  IpcApi,
  | "getLocalChanges"
  | "listWorktrees"
  | "stageFiles"
  | "unstageFiles"
  | "discardChanges"
  | "commitChanges"
>;

interface LocalChangesDependencies {
  listRepositories: typeof listRepositories;
  listWorktrees: typeof listWorktrees;
  getLocalChanges: typeof getLocalChanges;
  stageFiles: typeof stageFiles;
  unstageFiles: typeof unstageFiles;
  discardChanges: typeof discardChanges;
  commitChanges: typeof commitChanges;
}

export function createLocalChangesHandlers(
  dependencies: LocalChangesDependencies,
): LocalChangesHandlers {
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
    getLocalChanges: (repoPath) => dependencies.getLocalChanges(repoPath),
    listWorktrees: (repoPath) => dependencies.listWorktrees(repoPath),
    stageFiles: async (repoPath, paths) => {
      await assertRegisteredCheckout(repoPath);
      return dependencies.stageFiles(repoPath, paths);
    },
    unstageFiles: async (repoPath, paths) => {
      await assertRegisteredCheckout(repoPath);
      return dependencies.unstageFiles(repoPath, paths);
    },
    discardChanges: async (repoPath, paths) => {
      await assertRegisteredCheckout(repoPath);
      return dependencies.discardChanges(repoPath, paths);
    },
    commitChanges: async (repoPath, message) => {
      await assertRegisteredCheckout(repoPath);
      return dependencies.commitChanges(repoPath, message);
    },
  };
}

export const localChangesHandlers = createLocalChangesHandlers({
  listRepositories,
  listWorktrees,
  getLocalChanges,
  stageFiles,
  unstageFiles,
  discardChanges,
  commitChanges,
});
