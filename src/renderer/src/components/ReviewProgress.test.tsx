import { describe, expect, it } from "vitest";
import type {
  AnalysisResult,
  PullRequestDetail,
  PullRequestReview,
} from "../../../shared/types";
import { buildReviewSteps, type ReviewProgressInput } from "./ReviewProgress";

const detail = {
  repo: "acme/app",
  number: 7,
  headSha: "abc123",
  changedFiles: 4,
} as PullRequestDetail;

function steps(overrides: Partial<ReviewProgressInput> = {}) {
  const built = buildReviewSteps({
    detail,
    analysis: null,
    viewedFiles: [],
    draftCount: 0,
    reviews: [],
    viewer: "jamesofficer",
    ...overrides,
  });
  return Object.fromEntries(built.map((step) => [step.id, step]));
}

const analysis = (headSha: string) => ({ headSha }) as AnalysisResult;
const review = (author: string, state: PullRequestReview["state"]) =>
  ({ author, state }) as PullRequestReview;

describe("buildReviewSteps", () => {
  it("counts an analysis of the current commit as read", () => {
    expect(steps({ analysis: analysis("abc123") }).summary.state).toBe("done");
  });

  it("does not count an analysis of an older commit as read", () => {
    // The PR moved on, so the summary describes code that isn't on screen —
    // claiming that step is done would be claiming progress the reviewer
    // hasn't made.
    const step = steps({ analysis: analysis("old999") }).summary;
    expect(step.state).toBe("in_progress");
    expect(step.detail).toBe("Older commit");
  });

  it("reports partial file inspection", () => {
    const step = steps({ viewedFiles: ["a.ts", "b.ts"] }).files;
    expect(step.label).toBe("Inspect 4 files");
    expect(step.state).toBe("in_progress");
    expect(step.detail).toBe("2 of 4 viewed");
  });

  it("is done once every changed file has been viewed", () => {
    const viewedFiles = ["a.ts", "b.ts", "c.ts", "d.ts"];
    expect(steps({ viewedFiles }).files.state).toBe("done");
  });

  it("treats drafted comments as a review in progress", () => {
    const step = steps({ draftCount: 3 }).submit;
    expect(step.state).toBe("in_progress");
    expect(step.detail).toBe("3 draft comments");
  });

  it("only counts the viewer's own verdict as a submitted review", () => {
    const others = [review("meganb", "approved")];
    expect(steps({ reviews: others }).submit.state).toBe("pending");

    const mine = [...others, review("jamesofficer", "changes_requested")];
    expect(steps({ reviews: mine }).submit.state).toBe("done");
  });

  it("does not treat a bare comment as a submitted review", () => {
    const reviews = [review("jamesofficer", "commented")];
    expect(steps({ reviews }).submit.state).toBe("pending");
  });

  it("stays pending when there is no signed-in viewer to compare against", () => {
    // Without a token every review looks like somebody else's; pending is the
    // honest answer.
    const reviews = [review("jamesofficer", "approved")];
    expect(steps({ reviews, viewer: undefined }).submit.state).toBe("pending");
  });
});
