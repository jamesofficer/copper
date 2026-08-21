import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PullRequestReview } from "../../../shared/types";
import { renderWithProviders } from "../testing/render";
import ReviewerList from "./ReviewerList";

const approved: PullRequestReview = {
  id: 1,
  author: "grace",
  state: "approved",
  body: "",
  submittedAt: "2026-01-01T00:00:00Z",
};

describe("ReviewerList", () => {
  it("shows a new request instead of an earlier decision", () => {
    renderWithProviders(
      <ReviewerList reviews={[approved]} requestedReviewers={["grace"]} />,
    );

    expect(screen.getByText("Awaiting review")).toBeTruthy();
    expect(screen.queryByText("Approved")).toBeNull();
  });
});
