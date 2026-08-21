import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { stubApi } from "../../testing/api";
import { renderWithProviders } from "../../testing/render";
import CommitComposer from "./CommitComposer";

const pushLocalBranch = vi.fn();

beforeEach(() => {
  pushLocalBranch.mockReset();
  pushLocalBranch.mockResolvedValue({
    branch: "feature",
    target: "origin/feature",
  });
  stubApi({ pushLocalBranch });
});

describe("CommitComposer", () => {
  it("pushes the checked-out branch", async () => {
    renderWithProviders(
      <CommitComposer path="/repos/app" branch="feature" stagedCount={0} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Push" }));

    await waitFor(() => {
      expect(pushLocalBranch).toHaveBeenCalledWith("/repos/app");
    });
  });

  it("disables push on a detached HEAD", () => {
    renderWithProviders(<CommitComposer path="/repos/app" stagedCount={0} />);

    expect(
      (screen.getByRole("button", { name: "Push" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
