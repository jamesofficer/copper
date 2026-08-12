import { describe, expect, it, vi } from "vitest";
import type {
  CommitResult,
  LocalChanges,
  LocalCommitList,
} from "../../shared/types";
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
    getLocalChangeCount: vi.fn().mockResolvedValue(3),
    getLocalChanges: vi.fn().mockResolvedValue({
      branch: "main",
      staged: [],
      unstaged: [],
      untracked: [],
    } satisfies LocalChanges),
    listLocalCommits: vi.fn().mockResolvedValue({
      branch: "main",
      base: "origin/main",
      commits: [],
    } satisfies LocalCommitList),
    getLocalCommitFiles: vi.fn().mockResolvedValue([]),
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
  it("exposes the cheap changed-path count without loading file patches", async () => {
    const deps = dependencies();
    const handlers = createLocalChangesHandlers(deps);

    await expect(handlers.getLocalChangeCount("/repos/app")).resolves.toBe(3);

    expect(deps.getLocalChangeCount).toHaveBeenCalledWith("/repos/app");
    expect(deps.getLocalChanges).not.toHaveBeenCalled();
  });

  it("allows a mutation in a worktree belonging to a registered repository", async () => {
    const deps = dependencies();
    const handlers = createLocalChangesHandlers(deps);

    await handlers.stageFiles("/worktrees/feature", ["src/app.ts"]);

    expect(deps.listWorktrees).toHaveBeenCalledWith("/repos/app");
    expect(deps.stageFiles).toHaveBeenCalledWith("/worktrees/feature", [
      "src/app.ts",
    ]);
  });

  it("serializes mutations in the same checkout", async () => {
    const deps = dependencies();
    let finishStage: (() => void) | undefined;
    deps.stageFiles.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishStage = resolve;
        }),
    );
    const handlers = createLocalChangesHandlers(deps);

    const staging = handlers.stageFiles("/repos/app", ["one.ts"]);
    await vi.waitFor(() => expect(deps.stageFiles).toHaveBeenCalledOnce());
    const unstaging = handlers.unstageFiles("/repos/app", ["two.ts"]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const overlapped = deps.unstageFiles.mock.calls.length;

    finishStage?.();
    await Promise.all([staging, unstaging]);

    // Git protects the index with one lock. Starting a second write before the
    // first settles makes rapid row actions fail intermittently or lets a
    // commit race ahead of the staging operation it was meant to include.
    expect(overlapped).toBe(0);
    expect(deps.unstageFiles).toHaveBeenCalledOnce();
  });

  it("continues the checkout queue after a failed mutation", async () => {
    const deps = dependencies();
    let failStage: ((error: Error) => void) | undefined;
    deps.stageFiles.mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          failStage = reject;
        }),
    );
    const handlers = createLocalChangesHandlers(deps);

    const staging = handlers.stageFiles("/repos/app", ["one.ts"]);
    await vi.waitFor(() => expect(deps.stageFiles).toHaveBeenCalledOnce());
    const unstaging = handlers.unstageFiles("/repos/app", ["two.ts"]);
    failStage?.(new Error("index locked"));

    await expect(staging).rejects.toThrow(/index locked/i);
    await expect(unstaging).resolves.toBeUndefined();
    expect(deps.unstageFiles).toHaveBeenCalledOnce();
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
