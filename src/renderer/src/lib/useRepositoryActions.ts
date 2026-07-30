import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Repository } from "../../../shared/types";
import { toaster } from "../components/ui/toaster";

export interface RepositoryActions {
  repositories: Repository[] | undefined;
  reposPending: boolean;
  addRepository(): void;
  removeRepository(path: string): void;
  reorderRepositories(ordered: Repository[]): void;
}

// The registry plus the three things that change it. Shared because the
// sidebar owns the buttons while the home screen's empty state offers "Add
// repository" too, and both need the registered list.
export function useRepositoryActions(
  activePath: string | null,
  onActivePathChange: (path: string | null) => void,
): RepositoryActions {
  const queryClient = useQueryClient();

  const reposQuery = useQuery({
    queryKey: ["repositories"],
    queryFn: () => window.api.listRepositories(),
  });

  // Both sidebar PR sections and the repo rows' PR counts are scoped to
  // registered repos in the main process, so the registry changing means new
  // results.
  function invalidateRepoScoped() {
    void queryClient.invalidateQueries({ queryKey: ["reviewRequests"] });
    void queryClient.invalidateQueries({ queryKey: ["myPullRequests"] });
    void queryClient.invalidateQueries({ queryKey: ["openPrCounts"] });
  }

  async function add() {
    try {
      const added = await window.api.addRepository();
      if (!added) return;
      queryClient.setQueryData<Repository[]>(["repositories"], (prev) => [
        added,
        ...(prev ?? []).filter((repo) => repo.path !== added.path),
      ]);
      invalidateRepoScoped();
      onActivePathChange(added.path);
    } catch (cause) {
      toaster.create({
        type: "error",
        title: "Couldn’t add repository",
        description:
          cause instanceof Error
            ? cause.message.replace(/^.*Error: /, "")
            : String(cause),
        closable: true,
      });
    }
  }

  async function remove(path: string) {
    const remaining = await window.api.removeRepository(path);
    queryClient.setQueryData(["repositories"], remaining);
    invalidateRepoScoped();
    if (activePath === path || !activePath) {
      onActivePathChange(remaining[0]?.path ?? null);
    }
  }

  // Optimistic: show the new order immediately, then persist it. The main
  // process returns the saved list, which wins in case they disagree.
  function reorder(ordered: Repository[]) {
    queryClient.setQueryData(["repositories"], ordered);
    window.api
      .reorderRepositories(ordered.map((repo) => repo.path))
      .then((saved) => queryClient.setQueryData(["repositories"], saved))
      .catch(() =>
        queryClient.invalidateQueries({ queryKey: ["repositories"] }),
      );
  }

  return {
    repositories: reposQuery.data,
    reposPending: reposQuery.isPending,
    addRepository: () => void add(),
    removeRepository: (path) => void remove(path),
    reorderRepositories: reorder,
  };
}
