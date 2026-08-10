import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AnalysisResult,
  FindingsResult,
  PullRequest,
} from "../../../shared/types";
import { stubApi } from "../testing/api";
import { startAnalysis } from "./analysisJobs";

// A .tsx test so it runs in jsdom: the module reaches the toaster and the
// shared query client, both of which touch browser APIs at import time.

// Only repo and number are read off the PR.
const pr = { repo: "acme/app", number: 7 } as PullRequest;

const analysis = { summary: "It changes things." } as AnalysisResult;
const findings = { findings: [] } as unknown as FindingsResult;

describe("startAnalysis", () => {
  beforeEach(() => {
    stubApi();
  });

  it("stops after the analysis on a quick review", async () => {
    const analyzePullRequest = vi.fn().mockResolvedValue(analysis);
    const findIssues = vi.fn().mockResolvedValue(findings);
    stubApi({ analyzePullRequest, findIssues });

    await startAnalysis(pr, "quick");

    expect(analyzePullRequest).toHaveBeenCalledOnce();
    // The whole point of the quick option is that it doesn't spend the second,
    // pricier pass — so this is the assertion that protects the user's credits.
    expect(findIssues).not.toHaveBeenCalled();
  });

  it("chases the analysis with the findings pass on a deep review", async () => {
    const analyzePullRequest = vi.fn().mockResolvedValue(analysis);
    const findIssues = vi.fn().mockResolvedValue(findings);
    stubApi({ analyzePullRequest, findIssues });

    await startAnalysis(pr, "deep");

    expect(analyzePullRequest).toHaveBeenCalledOnce();
    // Forced, so a findings run cached for this commit without the analysis's
    // risks as leads gets replaced rather than reused.
    expect(findIssues).toHaveBeenCalledWith("acme/app", 7, true);
  });

  it("ignores a second run while one is in flight", async () => {
    const analyzePullRequest = vi.fn().mockResolvedValue(analysis);
    stubApi({ analyzePullRequest, findIssues: vi.fn() });

    // Both started before either is awaited — the guard is what stops a
    // double click from paying for the same analysis twice.
    await Promise.all([startAnalysis(pr, "quick"), startAnalysis(pr, "quick")]);

    expect(analyzePullRequest).toHaveBeenCalledOnce();
  });
});
