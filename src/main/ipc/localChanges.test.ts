import { describe, expect, it, vi } from "vitest";
import type { CommitResult, LocalChanges } from "../../shared/types";
import { createLocalChangesHandlers } from "./localChanges";

function dependencies() {
  return {
    listRepositories: vi
      .fn()
      .mockResolvedValue([
        { path: "/repos/app", name: "app", slug: "acme/app" },
      ]),
    listWorktrees: vi
      .fn()
      .mockResolvedValue([
        { path: "/worktrees/feature", branch: "feature", isMain: false },
      ]),
    getLocalChanges: vi.fn().mockResolvedValue({
      branch: "main",
      staged: [],
      unstaged: [],
      untracked: [],
    } satisfies LocalChanges),
    stageFiles: vi.fn().mockResolvedValue(undefined),
    unstageFiles: vi.fn().mockResolvedValue(undefined),
    discardChanges: vi.fn().mockResolvedValue(undefined),
    commitChanges: vi.fn().mockResolvedValue({
      sha: "abc1234",
      subject: "test",
    } satisfies CommitResult),
  };
}

describe("local changes IPC handlers", () => {
  it("allows a mutation in a worktree belonging to a registered repository", async () => {
    const deps = dependencies();
    const handlers = createLocalChangesHandlers(deps);

    await handlers.stageFiles("/worktrees/feature", ["src/app.ts"]);

    expect(deps.listWorktrees).toHaveBeenCalledWith("/repos/app");
    expect(deps.stageFiles).toHaveBeenCalledWith("/worktrees/feature", [
      "src/app.ts",
    ]);
  });

  it("rejects every mutation outside registered repositories and their worktrees", async () => {
    const deps = dependencies();
    const handlers = createLocalChangesHandlers(deps);
    const attempts = [
      () => handlers.stageFiles("/tmp/other", ["one.ts"]),
      () => handlers.unstageFiles("/tmp/other", ["one.ts"]),
      () => handlers.discardChanges("/tmp/other", ["one.ts"]),
      () => handlers.commitChanges("/tmp/other", "chore: nope"),
    ];

    for (const attempt of attempts) {
      await expect(attempt()).rejects.toThrow(/registered repository/i);
    }

    // The guard belongs before all filesystem-changing calls. In particular,
    // an arbitrary renderer path must never reach irreversible discard logic.
    expect(deps.stageFiles).not.toHaveBeenCalled();
    expect(deps.unstageFiles).not.toHaveBeenCalled();
    expect(deps.discardChanges).not.toHaveBeenCalled();
    expect(deps.commitChanges).not.toHaveBeenCalled();
  });
});
