import type { Worktree } from "../../../shared/types";

// The checkout that a Current Changes tab reads. The screen supplies the
// available worktrees and decides what a switch does.
export interface WorktreeSelection {
  worktrees: Worktree[] | undefined;
  path: string;
  select(path: string): void;
  refetch(): void;
}
