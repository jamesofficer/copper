import type { PullRequestFile } from "../../../shared/types";

export type LocalChangeArea = "staged" | "unstaged";

export interface LocalChangeSelection {
  area: LocalChangeArea;
  path: string;
}

export function localChangesBulkLabel(
  area: LocalChangeArea,
  filtered: boolean,
): string {
  const verb = area === "staged" ? "Unstage" : "Stage";
  return `${verb} ${filtered ? "shown" : "all"}`;
}

// A staged rename is one row but two index entries; unstaging only the new
// path would leave the old path's deletion staged.
export function withRenameSources(
  files: PullRequestFile[],
  paths: string[],
): string[] {
  const wanted = new Set(paths);
  const result = [...paths];
  for (const file of files) {
    if (file.previousPath && wanted.has(file.path)) {
      result.push(file.previousPath);
    }
  }
  return result;
}

interface ResolvedLocalChange {
  file: PullRequestFile | null;
  area: LocalChangeArea | null;
}

export function resolveLocalChangeSelection(
  selection: LocalChangeSelection | null,
  staged: PullRequestFile[],
  unstaged: PullRequestFile[],
): ResolvedLocalChange {
  if (selection) {
    const selectedFiles = selection.area === "staged" ? staged : unstaged;
    const selected = selectedFiles.find(
      (candidate) => candidate.path === selection.path,
    );
    if (selected) return { file: selected, area: selection.area };
  }

  if (unstaged[0]) return { file: unstaged[0], area: "unstaged" };
  if (staged[0]) return { file: staged[0], area: "staged" };
  return { file: null, area: null };
}
