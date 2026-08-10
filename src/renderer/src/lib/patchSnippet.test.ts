import { describe, expect, it } from "vitest";
import { patchSnippet } from "./patchSnippet";

// A two-hunk patch: the second hunk is deliberately far down the new file, so a
// snippet that ignored hunk boundaries would quote the wrong code.
const patch = [
  "@@ -1,4 +1,5 @@",
  " const a = 1;",
  "-const b = 2;",
  "+const b = 3;",
  "+const c = 4;",
  " const d = 5;",
  "@@ -40,3 +41,3 @@",
  " function far() {",
  "-  return old;",
  "+  return fresh;",
].join("\n");

describe("patchSnippet", () => {
  it("quotes the hunk holding the anchor line, markers and all", () => {
    // Line 42 is the "+  return fresh;" row in the second hunk.
    const snippet = patchSnippet(patch, 42);

    expect(snippet).toContain("+  return fresh;");
    expect(snippet).toContain("-  return old;");
    // From the second hunk only — the first hunk's code would be misleading.
    expect(snippet).not.toContain("const a = 1;");
  });

  it("describes exactly the rows it returns", () => {
    const snippet = patchSnippet(patch, 2);

    // Counted from the rows, not copied from the patch: the first hunk holds 3
    // old-side rows (context, del, context) and 4 new-side ones (context, add,
    // add, context), both starting at line 1. Copying the original header would
    // be wrong the moment a hunk is windowed.
    expect(snippet?.split("\n")[0]).toBe("@@ -1,3 +1,4 @@");
  });

  it("windows a long hunk around the anchor", () => {
    const long = [
      "@@ -1,40 +1,40 @@",
      ...Array.from({ length: 40 }, (_, index) => ` line ${index + 1}`),
    ].join("\n");

    const snippet = patchSnippet(long, 25);
    const rows = snippet?.split("\n") ?? [];

    // Header plus 10 rows either side of the anchor.
    expect(rows).toHaveLength(22);
    expect(rows[0]).toBe("@@ -15,21 +15,21 @@");
    expect(rows).toContain(" line 25");
    expect(rows).not.toContain(" line 1");
  });

  it("returns null when the line isn't in the diff", () => {
    // Quoting the nearest hunk instead would hand the reader code that has
    // nothing to do with the claim, which is worse than no code at all.
    expect(patchSnippet(patch, 500)).toBeNull();
  });

  it("ignores a deleted line's old-side number", () => {
    // New-file line 2 is "+const b = 3;", not the "-const b = 2;" above it.
    expect(patchSnippet(patch, 2)).toContain("+const b = 3;");
  });
});
