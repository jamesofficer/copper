import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { PullRequestDetail } from "../../../shared/types";
import { stubApi } from "../testing/api";
import { renderWithProviders } from "../testing/render";
import PullRequestSidebar from "./PullRequestSidebar";

const detail = {
  repo: "acme/app",
  number: 7,
  headSha: "abc123",
  state: "open",
  merged: false,
  changedFiles: 2,
  labels: [],
  reviewers: [],
  assignees: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
} as unknown as PullRequestDetail;

describe("PullRequestSidebar", () => {
  beforeEach(() => {
    stubApi();
  });

  it("states the empty cases rather than dropping the sections", () => {
    // A rail that hides its empty sections answers "who is reviewing this?"
    // with silence, which reads as "the panel didn't load".
    renderWithProviders(
      <PullRequestSidebar detail={detail} reviews={[]} showProgress={false} />,
    );

    expect(screen.getByText("No reviewers yet")).toBeTruthy();
    expect(screen.getByText("Nobody assigned")).toBeTruthy();
    expect(screen.getByText("No labels")).toBeTruthy();
  });

  it("offers people controls on an editable open pull request", () => {
    renderWithProviders(
      <PullRequestSidebar
        detail={detail}
        reviews={[]}
        showProgress={false}
        editable
      />,
    );

    expect(screen.getByRole("button", { name: "Edit reviewers" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit assignees" })).toBeTruthy();
  });

  it("leaves review status out of the preview panel", () => {
    // The progress steps cost a request each (viewed files, drafts, analysis);
    // the home-screen preview is a quick look, so it doesn't spend them — and
    // the stubbed api would throw if it tried.
    renderWithProviders(<PullRequestSidebar detail={detail} reviews={[]} />);

    expect(screen.queryByText("Review status")).toBeNull();
  });
});
