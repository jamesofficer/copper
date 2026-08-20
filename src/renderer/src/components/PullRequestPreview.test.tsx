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
    localStorage.clear();
    stubApi({ getPullRequest: () => new Promise(() => {}) });
  });

  it("opens the full pull request on its Overview tab", async () => {
    const onView = vi.fn();
    renderWithProviders(
      <PullRequestPreview pr={pr} onView={onView} onClose={() => {}} />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /view pull request/i }),
    );

    expect(onView).toHaveBeenCalledWith(pr, "overview");
  });

  it("offers favourite and copy-link actions in the preview", () => {
    renderWithProviders(
      <PullRequestPreview pr={pr} onView={() => {}} onClose={() => {}} />,
    );

    expect(
      screen.getByRole("button", { name: "Add to favourites" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
  });
});
