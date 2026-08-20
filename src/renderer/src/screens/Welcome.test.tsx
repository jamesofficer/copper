import { screen } from "@testing-library/react";
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

describe("Welcome pull request queue", () => {
  it("lists the repo's open pull requests as rows", async () => {
    stubApi({
      ...credentials,
      listPullRequests: vi.fn().mockResolvedValue([pullRequest]),
    });

    renderWelcome();

    expect(await screen.findByText("feat: send preview emails")).toBeTruthy();
    expect(screen.getByText(/ada · 1 commit · 2 files/)).toBeTruthy();
  });

  it("says the queue is quiet rather than showing an empty list", async () => {
    stubApi({
      ...credentials,
      listPullRequests: vi.fn().mockResolvedValue([]),
    });

    renderWelcome();

    expect(await screen.findByText(/nice and quiet/i)).toBeTruthy();
  });

  it("explains itself for a repo with no GitHub remote, and asks for no token", async () => {
    const listPullRequests = vi.fn();
    stubApi({ ...credentials, listPullRequests });

    renderWelcome({ path: "/repos/local", name: "local", slug: null });

    expect(
      await screen.findByText(/no GitHub remote, so pull requests/i),
    ).toBeTruthy();
    expect(listPullRequests).not.toHaveBeenCalled();
  });
});
