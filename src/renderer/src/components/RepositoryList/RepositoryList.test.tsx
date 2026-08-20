import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Repository } from "../../../../shared/types";
import { stubApi } from "../../testing/api";
import { renderWithProviders } from "../../testing/render";
import RepositoryList from "./RepositoryList";

const repository: Repository = {
  path: "/repos/app",
  name: "app",
  slug: "acme/app",
};

const listWorktrees = vi.fn();

const callbacks = {
  onSelectRepo: vi.fn(),
  onOpenIssues: vi.fn(),
  onOpenLocalChanges: vi.fn(),
  onRemoveRepo: vi.fn(),
  onReorder: vi.fn(),
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  listWorktrees.mockResolvedValue([
    { path: repository.path, branch: "main", isMain: true },
    {
      path: "/repos/app-feature",
      branch: "feat/tabs",
      isMain: false,
    },
  ]);
  stubApi({
    listWorktrees,
    getLocalChangeCount: vi
      .fn()
      .mockImplementation(async (path: string) =>
        path === repository.path ? 2 : 1,
      ),
  });
});

describe("RepositoryList", () => {
  it("expands a repository to show its destinations", async () => {
    renderWithProviders(
      <RepositoryList
        repositories={[repository]}
        activePath={repository.path}
        activeDestination={null}
        counts={{ "acme/app": { pullRequests: 12, issues: 8 } }}
        {...callbacks}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /^Pull requests/i }),
    ).toBeNull();
    expect(screen.queryByText("12")).toBeNull();
    expect(screen.queryByText("8")).toBeNull();
    expect(listWorktrees).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Expand app" }));
    expect(listWorktrees).toHaveBeenCalledWith(repository.path);

    expect(
      await screen.findByRole("button", { name: /^Pull requests\s*12/i }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Issues\s*8/i })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /^Current changes\s*2/i }),
    ).toBeTruthy();
    expect(
      await screen.findByRole("button", { name: /^feat\/tabs\s*1/i }),
    ).toBeTruthy();
  });

  it("opens each destination without changing the others", async () => {
    renderWithProviders(
      <RepositoryList
        repositories={[repository]}
        activePath={repository.path}
        activeDestination={{
          kind: "pullRequests",
          repoPath: repository.path,
        }}
        counts={{ "acme/app": { pullRequests: 12, issues: 8 } }}
        {...callbacks}
      />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /^Pull requests/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: /^Issues/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /^Current changes/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /^feat\/tabs/i }),
    );

    expect(callbacks.onSelectRepo).toHaveBeenCalledWith(repository.path);
    expect(callbacks.onOpenIssues).toHaveBeenCalledWith(repository);
    expect(callbacks.onOpenLocalChanges).toHaveBeenNthCalledWith(1, {
      repoPath: repository.path,
      worktreePath: repository.path,
      title: "app",
    });
    expect(callbacks.onOpenLocalChanges).toHaveBeenNthCalledWith(2, {
      repoPath: repository.path,
      worktreePath: "/repos/app-feature",
      title: "app (feat/tabs)",
    });
  });
});
