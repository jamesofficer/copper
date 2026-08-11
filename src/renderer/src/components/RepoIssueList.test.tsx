import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { REPO_ISSUE_LIMIT, type RepoIssue } from "../../../shared/types";
import { renderWithProviders } from "../testing/render";
import RepoIssueList from "./RepoIssueList";

function issues(count: number): RepoIssue[] {
  return Array.from({ length: count }, (_, index) => ({
    repo: "acme/app",
    number: index + 1,
    title: `Issue number ${index + 1}`,
    author: "ada",
    url: `https://github.com/acme/app/issues/${index + 1}`,
    labels: [],
    assignees: [],
    comments: 0,
    // Descending dates, so "newest" (the default sort) keeps the list in the
    // order it was built.
    createdAt: new Date(2026, 0, 1, 0, count - index).toISOString(),
    updatedAt: new Date(2026, 0, 1, 0, count - index).toISOString(),
  }));
}

// A Chakra select renders each label twice — once in the visible control, once
// in the hidden native <select> — so the label alone is ambiguous. The wrapper
// tells the two apart.
function pick(label: string, selector: string): HTMLElement {
  const match = screen
    .getAllByText(label)
    .map((el) => el.closest(selector))
    .find(Boolean);
  if (!(match instanceof HTMLElement)) {
    throw new Error(`no ${selector} for "${label}"`);
  }
  return match;
}

function render(list: RepoIssue[]) {
  return renderWithProviders(
    <RepoIssueList issues={list} preview={null} onSelect={() => {}} />,
  );
}

describe("RepoIssueList", () => {
  it("shows one page at a time, and the rest on the next page", async () => {
    const user = userEvent.setup();
    render(issues(38));

    expect(screen.getByText("Issue number 25")).toBeTruthy();
    expect(screen.queryByText("Issue number 26")).toBeNull();

    await user.click(screen.getByLabelText("Page 2"));

    expect(screen.getByText("Issue number 26")).toBeTruthy();
    expect(screen.getByText("Issue number 38")).toBeTruthy();
    expect(screen.queryByText("Issue number 25")).toBeNull();
  });

  it("goes back to page one when a filter changes", async () => {
    // Page 3 of the old sort says nothing about where the new one's results
    // are, and a page that no longer exists would show an empty list.
    const user = userEvent.setup();
    render(issues(38));

    await user.click(screen.getByLabelText("Page 2"));
    expect(screen.getByText("Issue number 26")).toBeTruthy();

    // The dropdowns live behind the queue's filter button.
    await user.click(screen.getByLabelText("Show filters"));
    await user.click(pick("Newest", "button"));
    await user.click(pick("Oldest", '[role="option"]'));

    expect(screen.getByText("Issue number 38")).toBeTruthy();
    expect(screen.queryByText("Issue number 1")).toBeNull();
  });

  it("carries no pagination chrome when everything fits on one page", () => {
    render(issues(6));

    expect(screen.queryByLabelText("Next page")).toBeNull();
    expect(screen.getByText("Issue number 6")).toBeTruthy();
  });

  it("says the list is only the newest slice once it hits the fetch limit", () => {
    // Otherwise a filter that matches nothing reads as "this repo has no such
    // issue", when it only means "not in the newest 50".
    render(issues(REPO_ISSUE_LIMIT));

    expect(screen.getByText(/most recently updated open issues/i)).toBeTruthy();
  });

  it("stays quiet about the limit when the repo has fewer issues than it", () => {
    render(issues(REPO_ISSUE_LIMIT - 1));

    expect(screen.queryByText(/most recently updated open issues/i)).toBeNull();
  });
});
