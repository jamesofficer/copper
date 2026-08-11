import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PullRequest } from "../../../shared/types";
import { stubApi } from "../testing/api";
import { renderWithProviders } from "../testing/render";
import PullRequestPreview from "./PullRequestPreview";

const pr = {
  repo: "acme/app",
  number: 7,
  title: "Hide test files in the Changes tab",
  url: "https://github.com/acme/app/pull/7",
} as PullRequest;

describe("PullRequestPreview", () => {
  beforeEach(() => {
    stubApi({ getPullRequest: () => new Promise(() => {}) });
  });

  it("opens the review screen on the Changes tab", async () => {
    // The button says "Review changes", and the reviewer has just read the
    // overview in this very panel — landing them on a second copy of it is the
    // one place the label would be a lie.
    const onView = vi.fn();
    renderWithProviders(
      <PullRequestPreview pr={pr} onView={onView} onClose={() => {}} />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /review changes/i }),
    );

    expect(onView).toHaveBeenCalledWith(pr, "changes");
  });
});
