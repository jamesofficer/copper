import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PullRequest, RepoIssue, Repository } from "../../shared/types";
import App from "./App";
import {
  initialTabsState,
  localChangesTabId,
  prTabId,
  QUEUE_TAB_ID,
  repoIssuesTabId,
} from "./lib/tabs/tabs";
import { useTabs } from "./lib/tabs/useTabs";
import { stubApi } from "./testing/api";
import { renderWithProviders } from "./testing/render";

// The logic is in lib/tabs/, and it has its own tests. These tests cover the
// connections that only App makes, and one rule that a user notices at once:
// a new repository must not close the tabs.

const appRepo: Repository = {
  path: "/repos/app",
  name: "app",
  slug: "acme/app",
};
const webRepo: Repository = {
  path: "/repos/web",
  name: "web",
  slug: "acme/web",
};

const issue: RepoIssue = {
  repo: "acme/app",
  number: 42,
  title: "Fix the broken tab",
  author: "ada",
  url: "https://github.com/acme/app/issues/42",
  labels: [],
  assignees: [],
  comments: 0,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};

function pr(number: number, title: string, repo = "acme/app"): PullRequest {
  return {
    repo,
    number,
    title,
    author: "ada",
    draft: false,
    reviewStatus: "awaiting_review",
    headSha: "abc1234",
    url: `https://github.com/${repo}/pull/${number}`,
    additions: 1,
    deletions: 0,
    changedFiles: 1,
    commits: 1,
    comments: 0,
    assignees: [],
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  };
}

beforeEach(() => {
  localStorage.clear();
  useTabs.setState(initialTabsState());
  stubApi({
    listRepositories: vi.fn().mockResolvedValue([appRepo, webRepo]),
    listPullRequests: vi.fn().mockResolvedValue([]),
    listRepoIssues: vi.fn().mockResolvedValue([issue]),
    getRepoCounts: vi.fn().mockResolvedValue({}),
    getSecretsStatus: vi.fn().mockResolvedValue({
      anthropic: false,
      github: false,
      openai: false,
    }),
    getLlmStatus: vi.fn().mockResolvedValue({ provider: "api", ready: false }),
    getLocalChangeCount: vi.fn().mockResolvedValue(0),
    getLocalChanges: vi.fn().mockResolvedValue({
      branch: "main",
      staged: [],
      unstaged: [],
      untracked: [],
    }),
    listLocalCommits: vi.fn().mockResolvedValue({
      branch: "main",
      base: "origin/main",
      commits: [],
    }),
    listWorktrees: vi.fn().mockResolvedValue([
      { path: appRepo.path, branch: "main", isMain: true },
      {
        path: "/repos/app-feature",
        branch: "feat/tabs",
        isMain: false,
      },
    ]),
    listReviewRequestedPullRequests: vi.fn().mockResolvedValue([]),
    listMyPullRequests: vi.fn().mockResolvedValue([]),
    listAnalyzedPullRequests: vi.fn().mockResolvedValue([]),
    getPullRequest: vi.fn().mockResolvedValue(null),
  });
});

describe("App tabs", () => {
  it("starts on the queue tab", async () => {
    renderWithProviders(<App />);

    expect(await screen.findByText("Pull Requests")).toBeTruthy();
    expect(useTabs.getState().activeId).toBe(QUEUE_TAB_ID);
  });

  it("keeps the open tabs when the user picks another repository", async () => {
    // This is the whole reason for the tabs. Before them, a new repository
    // closed the pull request on the screen.
    useTabs.getState().openPullRequest(pr(1, "Add the tab bar"));
    renderWithProviders(<App />);

    await userEvent.click(await screen.findByText("web"));

    expect(useTabs.getState().tabs.map((tab) => tab.id)).toEqual([
      QUEUE_TAB_ID,
      prTabId("acme/app", 1),
    ]);
    // The queue is the subject of a repository, so it comes forward.
    expect(useTabs.getState().activeId).toBe(QUEUE_TAB_ID);
  });

  it("opens the selected repository's issues in one top-level tab", async () => {
    renderWithProviders(<App />);

    await userEvent.click(await screen.findByRole("tab", { name: /issues/i }));

    expect(useTabs.getState().activeId).toBe(repoIssuesTabId(appRepo.path));
    expect(useTabs.getState().tabs.map((tab) => tab.id)).toEqual([
      QUEUE_TAB_ID,
      repoIssuesTabId(appRepo.path),
    ]);
    expect(await screen.findByText(issue.title)).toBeTruthy();
  });

  it("opens the selected repository's checkout in a top-level tab", async () => {
    renderWithProviders(<App />);

    await userEvent.click(await screen.findByRole("tab", { name: /changes/i }));

    expect(useTabs.getState().activeId).toBe(localChangesTabId(appRepo.path));
    expect(useTabs.getState().tabs.map((tab) => tab.id)).toEqual([
      QUEUE_TAB_ID,
      localChangesTabId(appRepo.path),
    ]);
    expect(await screen.findByText("Current changes")).toBeTruthy();
  });

  it("opens a second tab when the user switches worktrees", async () => {
    renderWithProviders(<App />);
    await userEvent.click(await screen.findByRole("tab", { name: /changes/i }));

    await userEvent.click(await screen.findByTitle("Switch worktree"));
    await userEvent.click(
      await screen.findByRole("option", { name: /feat\/tabs/i }),
    );

    expect(useTabs.getState().tabs.map((tab) => tab.id)).toEqual([
      QUEUE_TAB_ID,
      localChangesTabId(appRepo.path),
      localChangesTabId("/repos/app-feature"),
    ]);
    expect(useTabs.getState().activeId).toBe(
      localChangesTabId("/repos/app-feature"),
    );
  });

  it("shows the pull request of the active tab, and keeps its pane", async () => {
    useTabs.getState().openPullRequest(pr(1, "Add the tab bar"), "changes");
    renderWithProviders(<App />);

    // The screen shows the pane that the caller asked for.
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /changes/i })).toBeTruthy(),
    );
    const tab = useTabs
      .getState()
      .tabs.find((entry) => entry.id === prTabId("acme/app", 1));
    expect(tab?.kind === "pr" && tab.ui.tab).toBe("changes");
  });

  it("goes back to the queue when the user closes the last tab", async () => {
    useTabs.getState().openPullRequest(pr(1, "Add the tab bar"));
    renderWithProviders(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Close Add the tab bar" }),
    );

    expect(useTabs.getState().activeId).toBe(QUEUE_TAB_ID);
    expect(await screen.findByText("Pull Requests")).toBeTruthy();
  });
});
