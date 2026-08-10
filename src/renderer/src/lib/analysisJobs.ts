import { useSyncExternalStore } from "react";
import type { PullRequest, ReviewPersonality } from "../../../shared/types";
import { toaster } from "../components/ui/toaster";
import { cleanIpcError } from "./ipcError";
import { queryClient } from "./queryClient";
import { getReviewPersonality } from "./reviewPersonality";

// An analysis takes a minute or so, so it runs as a background job rather than
// something the review screen has to stay mounted for: the work already lives
// in the main process, and this store keeps track of it for the whole app. The
// sidebar shows a spinner while it runs and a toast says how it ended, so you
// can go and read something else meanwhile.
export type AnalysisStage = "analysing" | "checking";

// How far a review goes. A quick review is the analysis on its own; a deep one
// chases it with the findings pass, which reads the repo beyond the diff and
// verifies each flagged risk. The user picks per run — there is no default
// hidden in settings, because the two cost noticeably different amounts.
export type ReviewDepth = "quick" | "deep";

export interface AnalysisJob {
  pr: PullRequest;
  stage: AnalysisStage;
}

export interface StartAnalysisOptions {
  // Re-analysis: ignore the cached result, and clear what's on screen first.
  force?: boolean;
  // Just for this run — defaults to the setting.
  personality?: ReviewPersonality;
  // Re-analysis drops the Q&A chat, which answered against the old analysis.
  clearChat?: boolean;
}

function jobKey(repo: string, prNumber: number): string {
  return `${repo}#${prNumber}`;
}

const jobs = new Map<string, AnalysisJob>();
const listeners = new Set<() => void>();
// Rebuilt on every change, because useSyncExternalStore needs a snapshot whose
// identity only changes when the data does.
let snapshot: AnalysisJob[] = [];

function publish() {
  snapshot = [...jobs.values()];
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAnalysisJobs(): AnalysisJob[] {
  return useSyncExternalStore(subscribe, () => snapshot);
}

export function useAnalysisJob(
  repo: string,
  prNumber: number,
): AnalysisJob | undefined {
  return useSyncExternalStore(subscribe, () =>
    jobs.get(jobKey(repo, prNumber)),
  );
}

// Runs the analysis and, on a deep review, the findings pass after it. Depth is
// a required argument rather than an option with a default, so every entry point
// has to say which review the user asked for. Never throws: how it went is
// reported by a toast.
export async function startAnalysis(
  pr: PullRequest,
  depth: ReviewDepth,
  options: StartAnalysisOptions = {},
): Promise<void> {
  const key = jobKey(pr.repo, pr.number);
  // A second click while it's running would spend the credits twice.
  if (jobs.has(key)) return;

  const analysisKey = ["analysis", pr.repo, pr.number];
  const findingsKey = ["findings", pr.repo, pr.number];
  const chained = depth === "deep";

  jobs.set(key, { pr, stage: "analysing" });
  publish();

  if (options.force) {
    // Wipe the old review from screen — the Review tab drops back to its
    // analysing state instead of showing content about to be replaced.
    queryClient.setQueryData(analysisKey, null);
    queryClient.setQueryData(["chatHistory", pr.repo, pr.number], []);
    // The old findings verify the old analysis's risks, so they go too.
    if (chained) queryClient.setQueryData(findingsKey, null);
  }

  try {
    if (options.clearChat) await window.api.clearChat(pr.repo, pr.number);
    const analysis = await window.api.analyzePullRequest(
      pr.repo,
      pr.number,
      options.personality ?? getReviewPersonality(),
      options.force,
    );
    queryClient.setQueryData(analysisKey, analysis);
    void queryClient.invalidateQueries({ queryKey: ["analyzedPullRequests"] });
  } catch (cause) {
    jobs.delete(key);
    publish();
    // Bring the previous analysis back rather than leaving a blank tab.
    void queryClient.invalidateQueries({ queryKey: analysisKey });
    void queryClient.invalidateQueries({ queryKey: findingsKey });
    toaster.create({
      type: "error",
      title: "Analysis failed",
      description: `${key} — ${describe(cause)}`,
      closable: true,
    });
    return;
  }

  if (!chained) {
    finish(key, "Quick review ready", key);
    return;
  }

  jobs.set(key, { pr, stage: "checking" });
  publish();

  // The findings pass is a second run against the same commit, forced so that
  // a lead-less run cached for this commit is replaced. Its failure doesn't
  // undo the analysis, which is already on screen.
  try {
    const findings = await window.api.findIssues(pr.repo, pr.number, true);
    queryClient.setQueryData(findingsKey, findings);
    const count = findings.findings.length;
    finish(
      key,
      "Deep review ready",
      `${key} — ${count} issue${count === 1 ? "" : "s"} found`,
    );
  } catch (cause) {
    jobs.delete(key);
    publish();
    void queryClient.invalidateQueries({ queryKey: findingsKey });
    toaster.create({
      type: "warning",
      title: "Analysis ready, issue check failed",
      description: `${key} — ${describe(cause)}`,
      closable: true,
    });
  }
}

function finish(key: string, title: string, description: string) {
  jobs.delete(key);
  publish();
  toaster.create({ type: "success", title, description });
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cleanIpcError(cause.message) : String(cause);
}
