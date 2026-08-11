import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  LlmStatus,
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

function renderWelcome() {
  return renderWithProviders(
    <Welcome
      repositories={[repository]}
      reposPending={false}
      activeRepo={repository}
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
      getLocalChangeCount,
      getLocalChanges,
      listWorktrees: vi
        .fn()
        .mockResolvedValue([
          { path: repository.path, branch: "main", isMain: true },
        ]),
      listPullRequests: vi.fn().mockResolvedValue([]),
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
