import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisResult, PullRequest } from "../../../shared/types";
import { stubApi } from "../testing/api";
import { renderWithProviders } from "../testing/render";
import ReanalyzeButton from "./ReanalyzeButton";

// The component reads only repo and number off the PR, so the fixture supplies
// those rather than a full 20-field object that would obscure what matters.
const pr = { repo: "acme/app", number: 7 } as PullRequest;

const analysis = { summary: "It changes things." } as AnalysisResult;

describe("ReanalyzeButton", () => {
  beforeEach(() => {
    stubApi();
  });

  it("stays hidden while the PR has never been analysed", async () => {
    stubApi({ getAnalysis: vi.fn().mockResolvedValue(null) });

    const { container, queryClient } = renderWithProviders(
      <ReanalyzeButton pr={pr} />,
    );

    // Wait for the query to settle before asserting. An empty container is the
    // state on first paint too, so asserting straight away would pass whether
    // or not the component ever consulted the analysis.
    await waitFor(() =>
      expect(
        queryClient.getQueryState(["analysis", "acme/app", 7])?.status,
      ).toBe("success"),
    );

    // Offering "Re-analyse" before a first analysis exists would promise to
    // redo work that was never done. The Analyse button owns that case.
    expect(container.firstChild).toBeNull();
  });

  it("appears once an analysis exists", async () => {
    stubApi({ getAnalysis: vi.fn().mockResolvedValue(analysis) });

    renderWithProviders(<ReanalyzeButton pr={pr} />);

    expect(
      await screen.findByRole("button", { name: /re-analyse/i }),
    ).toBeTruthy();
  });

  it("asks the main process for this PR's analysis, not another's", async () => {
    const getAnalysis = vi.fn().mockResolvedValue(analysis);
    stubApi({ getAnalysis });

    renderWithProviders(<ReanalyzeButton pr={pr} />);

    // The query key and the call arguments have to agree, or one PR's button
    // renders off another PR's cached analysis.
    await waitFor(() =>
      expect(getAnalysis).toHaveBeenCalledWith("acme/app", 7),
    );
  });
});
