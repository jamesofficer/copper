import { describe, expect, it } from "vitest";
import type { ReviewComment } from "../../../shared/types";
import {
  buildReviewThreads,
  formatThreadRange,
  listReviewThreads,
} from "./reviewComments";

let nextId = 1;

function comment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  const id = overrides.id ?? nextId++;
  return {
    id,
    nodeId: `node-${id}`,
    author: "octocat",
    body: "Looks off to me.",
    createdAt: "2026-01-01T00:00:00Z",
    path: "src/app.ts",
    line: 12,
    startLine: null,
    side: "RIGHT",
    inReplyTo: null,
    diffHunk: "@@ -10,3 +10,3 @@",
    ...overrides,
  };
}

describe("listReviewThreads", () => {
  it("keeps a lone comment as its own thread", () => {
    const root = comment({ id: 1 });
    expect(listReviewThreads([root])).toEqual([{ root, replies: [] }]);
  });

  it("attaches replies to their root, oldest first", () => {
    const root = comment({ id: 1 });
    const first = comment({ id: 2, inReplyTo: 1, body: "Agreed." });
    const second = comment({ id: 3, inReplyTo: 1, body: "Fixed." });

    const [thread] = listReviewThreads([root, first, second]);
    expect(thread.root.id).toBe(1);
    expect(thread.replies.map((r) => r.id)).toEqual([2, 3]);
  });

  it("keeps separate roots as separate threads", () => {
    const threads = listReviewThreads([
      comment({ id: 1 }),
      comment({ id: 2, inReplyTo: 1 }),
      comment({ id: 3 }),
    ]);
    expect(threads).toHaveLength(2);
    expect(threads.map((t) => t.root.id)).toEqual([1, 3]);
  });

  // GitHub re-roots replies server-side when a root is deleted, so the client
  // has to cope with replies pointing at an id that is no longer present.
  // Losing them would silently drop a whole conversation.
  it("promotes an orphaned reply to a root rather than losing it", () => {
    const orphan = comment({ id: 2, inReplyTo: 1, body: "Agreed." });
    const threads = listReviewThreads([orphan]);
    expect(threads).toHaveLength(1);
    expect(threads[0].root.id).toBe(2);
  });

  it("gathers an orphan's siblings under the promoted root", () => {
    const first = comment({ id: 2, inReplyTo: 1, body: "Agreed." });
    const second = comment({ id: 3, inReplyTo: 1, body: "Fixed." });

    const threads = listReviewThreads([first, second]);
    expect(threads).toHaveLength(1);
    expect(threads[0].root.id).toBe(2);
    expect(threads[0].replies.map((r) => r.id)).toEqual([3]);
  });

  it("keeps outdated threads, which the conversation view still shows", () => {
    const threads = listReviewThreads([comment({ id: 1, line: null })]);
    expect(threads).toHaveLength(1);
  });
});

describe("buildReviewThreads", () => {
  it("groups threads by file path", () => {
    const byPath = buildReviewThreads([
      comment({ id: 1, path: "src/a.ts" }),
      comment({ id: 2, path: "src/b.ts" }),
      comment({ id: 3, path: "src/a.ts" }),
    ]);
    expect([...byPath.keys()].sort()).toEqual(["src/a.ts", "src/b.ts"]);
    expect(byPath.get("src/a.ts")).toHaveLength(2);
  });

  // Unlike the conversation view, the diff cannot render a thread whose anchor
  // no longer exists in it.
  it("drops outdated threads, which have no line to anchor to", () => {
    const byPath = buildReviewThreads([
      comment({ id: 1, line: null }),
      comment({ id: 2, line: 12 }),
    ]);
    expect(byPath.get("src/app.ts")).toHaveLength(1);
    expect(byPath.get("src/app.ts")?.[0].root.id).toBe(2);
  });

  it("keeps a thread's replies when grouping", () => {
    const byPath = buildReviewThreads([
      comment({ id: 1 }),
      comment({ id: 2, inReplyTo: 1 }),
    ]);
    expect(byPath.get("src/app.ts")?.[0].replies).toHaveLength(1);
  });

  it("returns an empty map for no comments", () => {
    expect(buildReviewThreads([]).size).toBe(0);
  });
});

describe("formatThreadRange", () => {
  it.each([
    ["a single line", { line: 12, startLine: null }, "line 12"],
    ["a range", { line: 12, startLine: 8 }, "lines 8–12"],
    // A start equal to the end is a single line, not a range.
    ["a collapsed range", { line: 12, startLine: 12 }, "line 12"],
  ])("describes %s", (_label, overrides, expected) => {
    expect(formatThreadRange(comment(overrides))).toBe(expected);
  });

  it("notes when the anchor is on the old side of the diff", () => {
    expect(formatThreadRange(comment({ side: "LEFT", line: 12 }))).toBe(
      "line 12 of the old version",
    );
  });

  it("returns null for an outdated comment", () => {
    expect(formatThreadRange(comment({ line: null }))).toBeNull();
  });
});
