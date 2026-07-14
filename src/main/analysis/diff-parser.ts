import type { ChangedFile } from "../../shared/types";

// TODO: raw unified diff → structured files/hunks, plus cheap mechanical
// classification (lockfiles, generated files, pure renames) without a model
export function parseDiff(rawDiff: string): ChangedFile[] {
  throw new Error(`Diff parsing not implemented yet (${rawDiff.length} bytes)`);
}
