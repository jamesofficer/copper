import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RepoIssueDetail } from "../../../shared/types";
import { renderWithProviders } from "../testing/render";
import RepoIssueSidebar from "./RepoIssueSidebar";

const detail = {
  repo: "acme/app",
  number: 7,
  labels: [],
  assignees: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
} as unknown as RepoIssueDetail;

describe("RepoIssueSidebar", () => {
  it("states the empty cases rather than dropping the sections", () => {
    // Same rule as the pull request's rail: a section that disappears when
    // empty reads as a panel that failed to load.
    renderWithProviders(<RepoIssueSidebar detail={detail} />);

    expect(screen.getByText("Nobody assigned")).toBeTruthy();
    expect(screen.getByText("No labels")).toBeTruthy();
  });

  it("has no review sections, which an issue can't answer", () => {
    renderWithProviders(<RepoIssueSidebar detail={detail} />);

    expect(screen.queryByText("Review status")).toBeNull();
    expect(screen.queryByText("Reviewers")).toBeNull();
  });
});
