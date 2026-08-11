import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Repository, Worktree } from "../../../shared/types";
import { worktreesQueryOptions } from "./repoQueries";

export interface WorktreeSelection {
  // The repo's checkouts, or undefined until the list loads.
  worktrees: Worktree[] | undefined;
  // The checkout to read — a picked worktree, or the registered repo.
  path: string;
  select(path: string): void;
  refetch(): void;
}

// Which of a repo's checkouts the Current changes tab reads. Agents often work
// in several worktrees at once, so the tab can be pointed at any of them.
export function useWorktreeSelection(
  repo: Repository | null,
): WorktreeSelection {
  const [selected, setSelected] = useState<string | null>(null);
  const query = useQuery(worktreesQueryOptions(repo?.path));
  const worktrees = query.data;

  // The selection only sticks while it names a listed worktree, so switching
  // repos or removing a worktree falls back to the registered path on its own,
  // with no effect to clear it.
  const path =
    selected && worktrees?.some((worktree) => worktree.path === selected)
      ? selected
      : (repo?.path ?? "");

  return {
    worktrees,
    path,
    select: setSelected,
    refetch: () => void query.refetch(),
  };
}
