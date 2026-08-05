import { describe, expect, it } from "vitest";
import type { PullRequestFile } from "../../../shared/types";
import { resolveLocalChangeSelection } from "./localChangesSelection";

function file(path: string, patch: string): PullRequestFile {
  return {
    path,
    previousPath: null,
    status: "modified",
    additions: 1,
    deletions: 1,
    patch,
  };
}

describe("resolveLocalChangeSelection", () => {
  it("classifies a fallback from the list where the file was actually found", () => {
    const moved = file("shared.ts", "unstaged diff");

    const result = resolveLocalChangeSelection(
      { area: "staged", path: "shared.ts" },
      [],
      [moved],
    );

    // Staging and unstaging move a path between groups after a refetch. A
    // stale selection area must not label the unstaged diff as staged merely
    // because the fallback file has the same path.
    expect(result).toEqual({ file: moved, area: "unstaged" });
  });

  it("keeps the selected side of a partially staged path", () => {
    const staged = file("shared.ts", "staged diff");
    const unstaged = file("shared.ts", "unstaged diff");

    expect(
      resolveLocalChangeSelection(
        { area: "staged", path: "shared.ts" },
        [staged],
        [unstaged],
      ),
    ).toEqual({ file: staged, area: "staged" });
    expect(
      resolveLocalChangeSelection(
        { area: "unstaged", path: "shared.ts" },
        [staged],
        [unstaged],
      ),
    ).toEqual({ file: unstaged, area: "unstaged" });
  });
});
