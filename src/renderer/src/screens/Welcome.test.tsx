import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  LlmStatus,
  PullRequest,
  Repository,
  SecretsStatus,
} from "../../../shared/types";
import { stubApi } from "../testing/api";
import { renderWithProviders } from "../testing/render";
import Welcome from "./Welcome";

const repository: Repository = {
  path: "/repos/app",
  name: "app",
  slug: "acme/app",
};

const pullRequest: PullRequest = {
  repo: "acme/app",
  number: 7,
  title: "feat: send preview emails",
  author: "ada",
  draft: false,
  reviewStatus: "awaiting_review",
  headSha: "abc1234",
  url: "https://github.com/acme/app/pull/7",
  additions: 12,
  deletions: 3,
  changedFiles: 2,
  commits: 1,
  comments: 0,
  assignees: [],
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};

const credentials = {
  getSecretsStatus: vi.fn().mockResolvedValue({
    anthropic: true,
    github: true,
  } satisfies SecretsStatus),
  getLlmStatus: vi.fn().mockResolvedValue({
    choice: "api-key",
    effective: "api-key",
    claudeCode: { available: false, account: null },
    apiKeyConfigured: true,
    models: { analysis: "analysis-model", chat: "chat-model" },
  } satisfies LlmStatus),
};

const localGit = {
  getLocalChangeCount: vi.fn().mockResolvedValue(0),
  listWorktrees: vi
    .fn()
    .mockResolvedValue([
      { path: repository.path, branch: "main", isMain: true },
    ]),
};

function renderWelcome(activeRepo: Repository | null = repository) {
  return renderWithProviders(
    <Welcome
      repositories={[repository]}
      reposPending={false}
      activeRepo={activeRepo}
      onAddRepo={vi.fn()}
      onSelect={vi.fn()}
      preview={null}
      onPreviewChange={vi.fn()}
      onOpenSettings={vi.fn()}
    />,
  );
}

describe("Welcome current changes queries", () => {
  it("loads a cheap count on the PR tab and defers file patches until the changes tab opens", async () => {
    const getLocalChangeCount = vi.fn().mockResolvedValue(2);
    const getLocalChanges = vi.fn().mockResolvedValue({
      branch: "main",
      staged: [],
      unstaged: [],
      untracked: [],
    });
    stubApi({
      ...credentials,
      ...localGit,
      getLocalChangeCount,
      getLocalChanges,
      listPullRequests: vi.fn().mockResolvedValue([]),
      getRepoCounts: vi.fn().mockResolvedValue({}),
    });

    renderWelcome();

    await waitFor(() => expect(getLocalChangeCount).toHaveBeenCalled());
    expect(getLocalChanges).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: /changes/i }));

    await waitFor(() =>
      expect(getLocalChanges).toHaveBeenCalledWith(repository.path),
    );
  });
});

describe("Welcome review queue", () => {
  it("lists the repo's open pull requests as rows", async () => {
    stubApi({
      ...credentials,
      ...localGit,
      listPullRequests: vi.fn().mockResolvedValue([pullRequest]),
      getRepoCounts: vi.fn().mockResolvedValue({}),
    });

    renderWelcome();

    expect(await screen.findByText("feat: send preview emails")).toBeTruthy();
    expect(screen.getByText(/ada · 1 commit · 2 files/)).toBeTruthy();
  });

  it("says the queue is quiet rather than showing an empty list", async () => {
    stubApi({
      ...credentials,
      ...localGit,
      listPullRequests: vi.fn().mockResolvedValue([]),
      getRepoCounts: vi.fn().mockResolvedValue({}),
    });

    renderWelcome();

    expect(await screen.findByText(/nice and quiet/i)).toBeTruthy();
  });

  it("explains itself for a repo with no GitHub remote, and asks for no token", async () => {
    const listPullRequests = vi.fn();
    stubApi({
      ...credentials,
      ...localGit,
      listPullRequests,
      getRepoCounts: vi.fn().mockResolvedValue({}),
    });

    renderWelcome({ path: "/repos/local", name: "local", slug: null });

    // Both list tabs say it, each naming what it can't load, so the noun is
    // what tells the pull-request panel's copy from the issue panel's.
    expect(
      await screen.findByText(/no GitHub remote, so pull requests/i),
    ).toBeTruthy();
    expect(screen.getByText(/no GitHub remote, so issues/i)).toBeTruthy();
    expect(listPullRequests).not.toHaveBeenCalled();
  });

  it("counts the tabs from GitHub's totals, not the loaded list", async () => {
    stubApi({
      ...credentials,
      ...localGit,
      listPullRequests: vi.fn().mockResolvedValue([pullRequest]),
      // A busy repo: the list is capped, the totals are not.
      getRepoCounts: vi
        .fn()
        .mockResolvedValue({ "acme/app": { pullRequests: 112, issues: 8 } }),
    });

    renderWelcome();

    expect(
      await screen.findByRole("tab", { name: /open\s*112/i }),
    ).toBeTruthy();
    expect(screen.getByRole("tab", { name: /issues\s*8/i })).toBeTruthy();
  });
});
