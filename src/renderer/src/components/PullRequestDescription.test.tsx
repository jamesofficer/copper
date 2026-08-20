import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PullRequestDetail } from "../../../shared/types";
import { renderWithProviders } from "../testing/render";
import PullRequestDescription from "./PullRequestDescription";

const detail = {
  repo: "acme/app",
  number: 7,
  body: "## Why\n\nKeep the original markdown.",
} as PullRequestDetail;

describe("PullRequestDescription", () => {
  it("shows copy and edit as icon actions", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    renderWithProviders(<PullRequestDescription detail={detail} editable />);

    expect(
      screen.getByRole("button", { name: "Edit description" }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Copy description markdown" }),
    );

    expect(writeText).toHaveBeenCalledWith(detail.body);
    expect(
      screen.getByRole("button", { name: "Description copied" }),
    ).toBeTruthy();
  });
});
