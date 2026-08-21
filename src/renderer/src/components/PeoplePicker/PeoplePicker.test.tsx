import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PullRequestDetail } from "../../../../shared/types";
import { stubApi } from "../../testing/api";
import { renderWithProviders } from "../../testing/render";
import PeoplePicker from "./PeoplePicker";

const listRepositoryPeople = vi.fn();
const setPullRequestReviewer = vi.fn();

const detail = {
  repo: "acme/app",
  number: 7,
  author: "author",
  reviewers: [],
  assignees: [],
} as unknown as PullRequestDetail;

beforeEach(() => {
  listRepositoryPeople.mockReset();
  listRepositoryPeople.mockResolvedValue({
    reviewers: ["author", "grace"],
    assignees: ["grace"],
  });
  setPullRequestReviewer.mockReset();
  setPullRequestReviewer.mockResolvedValue(undefined);
  stubApi({ listRepositoryPeople, setPullRequestReviewer });
});

describe("PeoplePicker", () => {
  it("loads reviewer candidates on open and requests a selected reviewer", async () => {
    renderWithProviders(<PeoplePicker detail={detail} kind="reviewers" />);

    fireEvent.click(screen.getByRole("button", { name: "Edit reviewers" }));

    await waitFor(() =>
      expect(listRepositoryPeople).toHaveBeenCalledWith("acme/app"),
    );
    expect(await screen.findByText("grace")).toBeTruthy();
    expect(screen.queryByText("author")).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: /grace/i }));

    await waitFor(() => {
      expect(setPullRequestReviewer).toHaveBeenCalledWith(
        "acme/app",
        7,
        "grace",
        true,
      );
    });
  });

  it("removes an existing review request", async () => {
    renderWithProviders(
      <PeoplePicker
        detail={{ ...detail, reviewers: ["grace"] }}
        kind="reviewers"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit reviewers" }));
    const checkbox = await screen.findByRole("checkbox", { name: /grace/i });

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(setPullRequestReviewer).toHaveBeenCalledWith(
        "acme/app",
        7,
        "grace",
        false,
      );
    });
  });
});
