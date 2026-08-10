import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RepoIssue, RepoIssueDetail } from "../../../shared/types";
import { stubApi } from "../testing/api";
import { renderWithProviders } from "../testing/render";
import RepoIssueOverview from "./RepoIssueOverview";

const issue: RepoIssue = {
  repo: "acme/app",
  number: 7,
  title: "Lessons stall on a slow network",
  author: "ada",
  url: "https://github.com/acme/app/issues/7",
  labels: [],
  assignees: [],
  comments: 2,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
};

const detail: RepoIssueDetail = {
  ...issue,
  body: "It hangs on the second card.",
  state: "open",
  stateReason: null,
};

describe("RepoIssueOverview", () => {
  beforeEach(() => {
    stubApi();
  });

  it("says the comments failed rather than showing an issue with none", async () => {
    // The conversation is conditional, so a silent failure renders an issue
    // that looks like nobody replied to it.
    const listRepoIssueComments = vi
      .fn()
      .mockRejectedValueOnce(new Error("GitHub is unreachable."))
      .mockResolvedValue([]);
    stubApi({
      getRepoIssue: () => Promise.resolve(detail),
      listRepoIssueComments,
    });

    renderWithProviders(<RepoIssueOverview issue={issue} />);

    expect(
      await screen.findByText(/couldn’t load the comments on this issue/i),
    ).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() =>
      expect(
        screen.queryByText(/couldn’t load the comments on this issue/i),
      ).toBeNull(),
    );
    expect(listRepoIssueComments).toHaveBeenCalledTimes(2);
  });

  it("reports a closed issue with no recorded reason as plain Closed", async () => {
    // GitHub only started recording a reason in 2022, so "not not_planned"
    // can't be read as "completed".
    stubApi({
      getRepoIssue: () =>
        Promise.resolve({ ...detail, state: "closed", stateReason: null }),
      listRepoIssueComments: () => Promise.resolve([]),
    });

    renderWithProviders(<RepoIssueOverview issue={issue} />);

    expect(await screen.findByText("Closed")).toBeTruthy();
    expect(screen.queryByText(/completed/i)).toBeNull();
  });

  it("names the reason when GitHub gave one", async () => {
    stubApi({
      getRepoIssue: () =>
        Promise.resolve({
          ...detail,
          state: "closed",
          stateReason: "duplicate" as const,
        }),
      listRepoIssueComments: () => Promise.resolve([]),
    });

    renderWithProviders(<RepoIssueOverview issue={issue} />);

    expect(await screen.findByText("Closed as duplicate")).toBeTruthy();
  });
});
