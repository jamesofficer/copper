import type { DiffSide, Explanation } from "../../../shared/types";

// A diff line an explanation can anchor to: which side it's on, its line
// number on that side, and its text.
export interface AnchoredLine {
  side: DiffSide;
  line: number;
  text: string;
}

// An explanation placed against the CURRENT diff. Explanations are written
// against one commit and re-read against every later one, so both the stored
// anchor and the stored code snapshot get re-validated on each render.
export interface ResolvedExplanation {
  explanation: Explanation;
  // The explained lines have changed since the answer was written. The card
  // stays and says so — these are local-only, so badge rather than delete.
  stale: boolean;
  // Where to render it in the diff on screen.
  line: number;
  startLine: number | null;
  // The text now at that range — what "Re-explain" runs against.
  currentCode: string;
}

// Text of the lines in [start, end] on one side, in diff order. Lines the
// current diff doesn't show are simply absent, so a partial hit can never
// equal the stored snapshot.
function textAt(
  lines: AnchoredLine[],
  side: DiffSide,
  start: number,
  end: number,
): string {
  return lines
    .filter(
      (entry) =>
        entry.side === side && entry.line >= start && entry.line <= end,
    )
    .map((entry) => entry.text)
    .join("\n");
}

// Where the snapshot's lines sit now, if they moved as a block. A run has to
// be consecutive by line number, so a match can't span a hunk boundary.
function findCode(
  lines: AnchoredLine[],
  side: DiffSide,
  code: string,
): { line: number; startLine: number | null } | null {
  const wanted = code.split("\n");
  const onSide = lines.filter((entry) => entry.side === side);

  for (let start = 0; start + wanted.length <= onSide.length; start++) {
    let matched = true;
    for (let offset = 0; offset < wanted.length; offset++) {
      const entry = onSide[start + offset];
      const previous = onSide[start + offset - 1];
      if (
        entry.text !== wanted[offset] ||
        (offset > 0 && entry.line !== previous.line + 1)
      ) {
        matched = false;
        break;
      }
    }
    if (!matched) continue;
    const first = onSide[start].line;
    const last = onSide[start + wanted.length - 1].line;
    return { line: last, startLine: wanted.length > 1 ? first : null };
  }
  return null;
}

function nearestLine(
  lines: AnchoredLine[],
  side: DiffSide,
  target: number,
): number | null {
  let best: number | null = null;
  for (const entry of lines) {
    if (entry.side !== side) continue;
    if (
      best === null ||
      Math.abs(entry.line - target) < Math.abs(best - target)
    ) {
      best = entry.line;
    }
  }
  return best;
}

export function resolveExplanation(
  explanation: Explanation,
  currentSha: string,
  lines: AnchoredLine[],
): ResolvedExplanation {
  const { side, code } = explanation;
  const start = explanation.startLine ?? explanation.line;
  const atAnchor = textAt(lines, side, start, explanation.line);

  // Written against this very commit, or the code is still exactly where it
  // was left — nothing to flag.
  if (explanation.headSha === currentSha || atAnchor === code) {
    return {
      explanation,
      stale: false,
      line: explanation.line,
      startLine: explanation.startLine,
      currentCode: atAnchor || code,
    };
  }

  // Unchanged code that the new diff merely renumbered — snap to it quietly.
  // Any edit earlier in the file shifts every line below it, so this is the
  // common case; badging it would teach people to ignore the badge.
  const moved = findCode(lines, side, code);
  if (moved) {
    return { explanation, stale: false, ...moved, currentCode: code };
  }

  // The explained lines really did change. Keep the stored anchor when those
  // line numbers still exist, otherwise snap to the closest line on screen so
  // the card can't silently disappear.
  if (atAnchor) {
    return {
      explanation,
      stale: true,
      line: explanation.line,
      startLine: explanation.startLine,
      currentCode: atAnchor,
    };
  }

  const nearest = nearestLine(lines, side, explanation.line);
  if (nearest === null) {
    return {
      explanation,
      stale: true,
      line: explanation.line,
      startLine: explanation.startLine,
      currentCode: "",
    };
  }

  const span = explanation.line - start;
  const snappedStart = span > 0 ? nearest - span : null;
  return {
    explanation,
    stale: true,
    line: nearest,
    startLine: snappedStart,
    currentCode: textAt(lines, side, snappedStart ?? nearest, nearest),
  };
}
