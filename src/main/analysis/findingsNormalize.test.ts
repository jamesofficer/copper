import { describe, expect, it } from "vitest";
import type { PullRequestFile } from "../../shared/types";
import {
  contentId,
  normalizeFindings,
  type RawFinding,
} from "./findingsNormalize";

// A patch whose new-file side covers lines 10-14: one context line, two added,
// one deleted (which occupies no new-file line), then two more context lines.
const PATCH = [
  "@@ -10,4 +10,5 @@",
  " const a = 1;",
  "+const b = 2;",
  "+const c = 3;",
  "-const old = 0;",
  " const d = 4;",
  " const e = 5;",
].join("\n");

function file(overrides: Partial<PullRequestFile> = {}): PullRequestFile {
  return {
    path: "src/app.ts",
    previousPath: null,
    status: "modified",
    additions: 2,
    deletions: 1,
    patch: PATCH,
    ...overrides,
  };
}

function raw(overrides: Partial<RawFinding> = {}): RawFinding {
  return {
    category: "bug",
    severity: "medium",
    title: "Off-by-one in the loop bound",
    body: "The loop runs one iteration too many.",
    path: "src/app.ts",
    line: 11,
    ...overrides,
  };
}

describe("normalizeFindings anchoring", () => {
  it("keeps a finding whose line is already in the diff", () => {
    const [finding] = normalizeFindings([raw({ line: 11 })], [file()]);
    expect(finding.line).toBe(11);
  });

  // The model often lands a line or two off. Snapping is what makes the
  // finding postable instead of discarded.
  it("snaps a near-miss line to the nearest line in the diff", () => {
    const [finding] = normalizeFindings([raw({ line: 99 })], [file()]);
    expect(finding.line).toBe(14);
  });

  it("drops a finding pointing at a file that is not in the diff", () => {
    const findings = normalizeFindings(
      [raw({ path: "src/untouched.ts" })],
      [file()],
    );
    expect(findings).toEqual([]);
  });

  it("drops a finding when the file has no patch to anchor against", () => {
    const findings = normalizeFindings([raw()], [file({ patch: null })]);
    expect(findings).toEqual([]);
  });

  // Deleted lines exist in the patch but occupy no new-file line, so a comment
  // cannot be anchored to one.
  it("never anchors to a deleted line's position", () => {
    const lines = normalizeFindings(
      [
        raw({ line: 1, title: "a" }),
        raw({ line: 500, title: "b", category: "security" }),
      ],
      [file()],
    ).map((finding) => finding.line);
    // 10-14 are the new-file lines this patch covers; the deleted line sits
    // between 12 and 13 and is never a candidate.
    for (const line of lines) {
      expect(line).toBeGreaterThanOrEqual(10);
      expect(line).toBeLessThanOrEqual(14);
    }
  });

  it.each([
    ["missing title", { title: undefined }],
    ["missing body", { body: undefined }],
    ["missing path", { path: undefined }],
    ["blank title", { title: "   " }],
  ])("drops a finding with a %s", (_label, overrides) => {
    expect(normalizeFindings([raw(overrides)], [file()])).toEqual([]);
  });
});

describe("normalizeFindings identity", () => {
  // The id is what carries a user's accept/dismiss across re-runs, so it must
  // depend only on category, path and line.
  it("gives the same finding the same id across runs", () => {
    const first = normalizeFindings([raw()], [file()])[0];
    const second = normalizeFindings(
      [raw({ title: "Reworded by the model", severity: "high" })],
      [file()],
    )[0];
    expect(second.id).toBe(first.id);
  });

  it("changes the id when the category changes", () => {
    const bug = normalizeFindings([raw({ category: "bug" })], [file()])[0];
    const security = normalizeFindings(
      [raw({ category: "security" })],
      [file()],
    )[0];
    expect(security.id).not.toBe(bug.id);
  });

  it("keeps only the first of two findings that resolve to the same anchor", () => {
    const findings = normalizeFindings(
      [raw({ title: "First" }), raw({ title: "Second" })],
      [file()],
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe("First");
  });

  it("derives ids that are short and stable", () => {
    expect(contentId("bug|src/app.ts|11")).toBe(contentId("bug|src/app.ts|11"));
    expect(contentId("a")).toHaveLength(12);
    expect(contentId("a")).not.toBe(contentId("b"));
  });
});

describe("normalizeFindings field handling", () => {
  it("sorts high severity first and low last", () => {
    const findings = normalizeFindings(
      [
        raw({ severity: "low", line: 10, category: "bug" }),
        raw({ severity: "high", line: 12, category: "edge_case" }),
        raw({ severity: "medium", line: 13, category: "security" }),
      ],
      [file()],
    );
    expect(findings.map((f) => f.severity)).toEqual(["high", "medium", "low"]);
  });

  it.each([
    ["an unknown severity", { severity: "catastrophic" }, "medium"],
    ["a missing severity", { severity: undefined }, "medium"],
  ])("falls back to medium for %s", (_label, overrides, expected) => {
    expect(normalizeFindings([raw(overrides)], [file()])[0].severity).toBe(
      expected,
    );
  });

  it("falls back to the bug category for an unknown one", () => {
    expect(
      normalizeFindings([raw({ category: "vibes" })], [file()])[0].category,
    ).toBe("bug");
  });

  it("uses the body as the suggestion when none was given", () => {
    const finding = normalizeFindings(
      [raw({ suggestion: undefined })],
      [file()],
    )[0];
    expect(finding.suggestion).toBe("The loop runs one iteration too many.");
  });

  it("keeps a real suggestion, trimmed", () => {
    const finding = normalizeFindings(
      [raw({ suggestion: "  Guard against null here.  " })],
      [file()],
    )[0];
    expect(finding.suggestion).toBe("Guard against null here.");
  });

  it("normalises a missing lead to null rather than leaving it undefined", () => {
    expect(normalizeFindings([raw()], [file()])[0].lead).toBeNull();
  });
});
