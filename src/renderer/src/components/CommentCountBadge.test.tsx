import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../testing/render";
import CommentCountBadge from "./CommentCountBadge";

describe("CommentCountBadge", () => {
  it("renders nothing at all for a PR with no comments", () => {
    const { container } = renderWithProviders(<CommentCountBadge count={0} />);

    // Not "renders a 0" — the chip is meant to disappear, so that PR cards and
    // sidebar rows don't carry a column of zeros. An empty container is the
    // whole contract.
    expect(container.firstChild).toBeNull();
  });

  it("shows the count once there is at least one comment", () => {
    renderWithProviders(<CommentCountBadge count={1} />);

    expect(screen.getByText("1")).toBeTruthy();
  });

  it("shows a large count as-is rather than abbreviating it", () => {
    renderWithProviders(<CommentCountBadge count={128} />);

    expect(screen.getByText("128")).toBeTruthy();
  });
});
