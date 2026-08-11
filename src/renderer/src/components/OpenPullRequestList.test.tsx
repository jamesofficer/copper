import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { PullRequest } from "../../../shared/types";
import { renderWithProviders } from "../testing/render";
import OpenPullRequestList from "./OpenPullRequestList";

function pullRequests(count: number): PullRequest[] {
  return Array.from({ length: count }, (_, index) => ({
    repo: "acme/app",
    number: index + 1,
    title: `Change number ${index + 1}`,
    author: index === 0 ? "grace" : "ada",
    draft: false,
    reviewStatus: "awaiting_review" as const,
    headSha: "abc1234",
    url: `https://github.com/acme/app/pull/${index + 1}`,
    additions: 10,
    deletions: 2,
    changedFiles: 3,
    commits: 1,
    comments: 0,
    assignees: [],
    createdAt: new Date(2026, 0, 1, 0, count - index).toISOString(),
    updatedAt: new Date(2026, 0, 1, 0, count - index).toISOString(),
  }));
}

function render(prs: PullRequest[]) {
  return renderWithProviders(
    <OpenPullRequestList
      prs={prs}
      preview={null}
      onSelect={() => {}}
      onOpen={() => {}}
    />,
  );
}

describe("OpenPullRequestList", () => {
  it("shows each pull request's number, author and counts", () => {
    render(pullRequests(1));

    expect(screen.getByText("Change number 1")).toBeTruthy();
    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText(/grace · 1 commit · 3 files/)).toBeTruthy();
  });

  it("filters on the text box", async () => {
    const user = userEvent.setup();
    render(pullRequests(3));

    await user.type(
      screen.getByPlaceholderText("Filter pull requests"),
      "number 2",
    );

    expect(screen.getByText("Change number 2")).toBeTruthy();
    expect(screen.queryByText("Change number 1")).toBeNull();
  });

  it("says so when nothing matches, rather than looking empty", async () => {
    const user = userEvent.setup();
    render(pullRequests(3));

    await user.type(
      screen.getByPlaceholderText("Filter pull requests"),
      "nothing here",
    );

    expect(screen.getByText(/no pull requests match/i)).toBeTruthy();
  });
});
