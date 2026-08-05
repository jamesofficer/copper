import { escapeHtml, highlightToLines } from "./highlighter";
import type { SyntaxThemePair } from "./syntaxTheme";

export type LineKind = "hunk" | "add" | "del" | "context" | "meta";

export interface DiffLine {
  kind: LineKind;
  oldNumber: number | null;
  newNumber: number | null;
  text: string;
  html: string;
  // True for context rows spliced in by "expand hidden lines" — they aren't
  // part of the actual diff, so GitHub can't anchor review comments to them.
  expanded?: boolean;
}

export { escapeHtml, highlightToLines, languageForPath } from "./highlighter";

// Each hunk is highlighted as two documents — the old side (del + context
// lines) and the new side (add + context lines) — both contiguous slices of
// their file version, so multi-line constructs keep their state. Hunks are
// deliberately NOT concatenated: the unseen gap between them could open or
// close anything, and a wrong carried-over state would poison every hunk
// after it.
function highlightSegment(
  segment: DiffLine[],
  language: string | null,
  themes: SyntaxThemePair,
): void {
  const newSide = segment.filter((line) => line.kind !== "del");
  const oldSide = segment.filter((line) => line.kind !== "add");
  const newHtml = language
    ? highlightToLines(
        newSide.map((line) => line.text).join("\n"),
        language,
        themes,
      )
    : null;
  const oldHtml = language
    ? highlightToLines(
        oldSide.map((line) => line.text).join("\n"),
        language,
        themes,
      )
    : null;
  newSide.forEach((line, index) => {
    line.html =
      newHtml && newHtml.length === newSide.length
        ? newHtml[index]
        : escapeHtml(line.text);
  });
  oldSide.forEach((line, index) => {
    if (line.kind !== "del") return;
    line.html =
      oldHtml && oldHtml.length === oldSide.length
        ? oldHtml[index]
        : escapeHtml(line.text);
  });
}

function applyHighlighting(
  lines: DiffLine[],
  language: string | null,
  themes: SyntaxThemePair,
): void {
  let segment: DiffLine[] = [];
  for (const line of lines) {
    if (line.kind === "hunk") {
      highlightSegment(segment, language, themes);
      segment = [];
    } else if (line.kind !== "meta") {
      // "\ No newline" markers sit inside a change block — skip, don't split.
      segment.push(line);
    }
  }
  highlightSegment(segment, language, themes);
}

// One row of a side-by-side diff. Context/hunk/meta lines appear on both
// sides; paired del/add lines sit opposite each other; an unpaired change
// leaves the other side empty (null).
export interface SplitRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

export function buildSplitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.kind === "del") {
      // A run of deletions followed by a run of additions is one change
      // block — zip the two runs so old and new sit opposite each other.
      const dels: DiffLine[] = [];
      while (i < lines.length && lines[i].kind === "del") dels.push(lines[i++]);
      const adds: DiffLine[] = [];
      while (i < lines.length && lines[i].kind === "add") adds.push(lines[i++]);
      for (let j = 0; j < Math.max(dels.length, adds.length); j++) {
        rows.push({ left: dels[j] ?? null, right: adds[j] ?? null });
      }
    } else if (line.kind === "add") {
      rows.push({ left: null, right: line });
      i++;
    } else {
      rows.push({ left: line, right: line });
      i++;
    }
  }
  return rows;
}

// The theme pair is a parameter rather than something the highlighter reads
// off a global: the returned html depends on it, so a caller that re-parses
// after a theme change must be able to see that in the arguments (and pass it
// to a memo's dependency list).
export function parsePatch(
  patch: string,
  language: string | null,
  themes: SyntaxThemePair,
): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldNumber = 0;
  let newNumber = 0;

  for (const raw of patch.split("\n")) {
    if (raw.startsWith("@@")) {
      const match = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldNumber = Number(match[1]);
        newNumber = Number(match[2]);
      }
      lines.push({
        kind: "hunk",
        oldNumber: null,
        newNumber: null,
        text: raw,
        html: "",
      });
      continue;
    }
    if (raw.startsWith("+")) {
      const text = raw.slice(1);
      lines.push({
        kind: "add",
        oldNumber: null,
        newNumber,
        text,
        html: "",
      });
      newNumber++;
      continue;
    }
    if (raw.startsWith("-")) {
      const text = raw.slice(1);
      lines.push({
        kind: "del",
        oldNumber,
        newNumber: null,
        text,
        html: "",
      });
      oldNumber++;
      continue;
    }
    if (raw.startsWith("\\")) {
      lines.push({
        kind: "meta",
        oldNumber: null,
        newNumber: null,
        text: raw,
        html: "",
      });
      continue;
    }
    if (raw === "") continue;

    const text = raw.slice(1);
    lines.push({
      kind: "context",
      oldNumber,
      newNumber,
      text,
      html: "",
    });
    oldNumber++;
    newNumber++;
  }

  applyHighlighting(lines, language, themes);
  return lines;
}

function parseHunkHeader(
  text: string,
): { oldStart: number; newStart: number } | null {
  const match = text.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  return match
    ? { oldStart: Number(match[1]), newStart: Number(match[2]) }
    : null;
}

// Gap id for the stretch between the last hunk and the end of the file.
export const TAIL_GAP = -1;

// Hidden-line counts for each expandable gap in a parsed patch, keyed by the
// hunk line's index in `lines` (TAIL_GAP for the tail). Gaps between hunks
// are known from the headers alone; the tail needs the file's total line
// count — null there means "unknown, possibly some".
export function computeGaps(
  lines: DiffLine[],
  fileLineCount: number | null,
): Map<number, number | null> {
  const gaps = new Map<number, number | null>();
  let lastNew = 0;
  let sawHunk = false;
  lines.forEach((line, index) => {
    if (line.kind === "hunk") {
      const header = parseHunkHeader(line.text);
      if (header) {
        gaps.set(index, Math.max(0, header.newStart - lastNew - 1));
        sawHunk = true;
      }
    } else if (line.newNumber !== null) {
      lastNew = Math.max(lastNew, line.newNumber);
    }
  });
  if (sawHunk) {
    gaps.set(
      TAIL_GAP,
      fileLineCount === null ? null : Math.max(0, fileLineCount - lastNew),
    );
  }
  return gaps;
}

// Splices expanded gaps into a parsed patch as extra context rows, read from
// the full new-file contents. Hidden regions are unchanged code, so old line
// numbers are recovered by offsetting the new ones. A fully expanded gap's
// hunk header is dropped — everything it summarised is now visible.
export function expandLines(
  lines: DiffLine[],
  expanded: ReadonlySet<number>,
  fileLines: string[],
  fileHtml: string[] | null,
): DiffLine[] {
  const result: DiffLine[] = [];
  let lastOld = 0;
  let lastNew = 0;

  function pushContext(fromNew: number, toNew: number, oldOffset: number) {
    for (let n = fromNew; n <= toNew; n++) {
      const text = fileLines[n - 1];
      if (text === undefined) break;
      result.push({
        kind: "context",
        oldNumber: n - oldOffset,
        newNumber: n,
        text,
        html: fileHtml?.[n - 1] ?? escapeHtml(text),
        expanded: true,
      });
    }
  }

  lines.forEach((line, index) => {
    if (line.kind === "hunk") {
      const header = parseHunkHeader(line.text);
      if (header && expanded.has(index)) {
        pushContext(
          lastNew + 1,
          header.newStart - 1,
          header.newStart - header.oldStart,
        );
        return;
      }
      result.push(line);
      return;
    }
    if (line.oldNumber !== null) lastOld = line.oldNumber;
    if (line.newNumber !== null) lastNew = line.newNumber;
    result.push(line);
  });

  if (expanded.has(TAIL_GAP)) {
    pushContext(lastNew + 1, fileLines.length, lastNew - lastOld);
  }
  return result;
}
