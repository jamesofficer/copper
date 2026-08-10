// Pulling the code an issue points at out of a file's unified diff, so it can
// be pasted somewhere that has no access to the repo. Kept separate from
// lib/diffParser.ts on purpose: that one produces syntax-highlighted HTML for
// the screen and needs a theme, while this is text in, text out.

interface Row {
  text: string;
  // Line numbers this row occupies, or — for a row that exists on one side
  // only — the next number on the other side, which is what a hunk header
  // means by its start values.
  oldAt: number;
  newAt: number;
  onOld: boolean;
  onNew: boolean;
}

// Rows either side of the anchor. Enough to see the surrounding function
// without turning a clipboard paste into a whole file.
const CONTEXT = 10;

function parseHunks(patch: string): Row[][] {
  const hunks: Row[][] = [];
  let rows: Row[] | null = null;
  let oldAt = 0;
  let newAt = 0;

  for (const text of patch.split("\n")) {
    const header = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
    if (header) {
      rows = [];
      hunks.push(rows);
      oldAt = Number(header[1]);
      newAt = Number(header[2]);
      continue;
    }
    if (rows === null) continue;
    // "\ No newline at end of file" annotates the row above and numbers
    // nothing, so it is carried along rather than counted.
    if (text.startsWith("\\")) {
      rows.push({ text, oldAt, newAt, onOld: false, onNew: false });
      continue;
    }
    const onOld = text.startsWith("-") || text.startsWith(" ") || text === "";
    const onNew = text.startsWith("+") || text.startsWith(" ") || text === "";
    if (!onOld && !onNew) continue;
    rows.push({ text: text === "" ? " " : text, oldAt, newAt, onOld, onNew });
    if (onOld) oldAt += 1;
    if (onNew) newAt += 1;
  }

  return hunks;
}

// Rebuilt rather than reused from the patch: the window is usually a slice of a
// larger hunk, so the original header's line counts would describe lines that
// aren't there.
function header(window: Row[]): string {
  const oldCount = window.filter((row) => row.onOld).length;
  const newCount = window.filter((row) => row.onNew).length;
  const first = window[0];
  const oldStart = oldCount === 0 ? 0 : first.oldAt;
  const newStart = newCount === 0 ? 0 : first.newAt;
  return `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;
}

// The part of `patch` around `line` (a new-file line number) as unified diff
// text, complete with a hunk header describing exactly the rows returned.
// Null when the line isn't in the diff at all — a wrong snippet would be worse
// than none, since the whole point is that the reader can't check it.
export function patchSnippet(patch: string, line: number): string | null {
  for (const rows of parseHunks(patch)) {
    const index = rows.findIndex((row) => row.onNew && row.newAt === line);
    if (index === -1) continue;
    const window = rows.slice(
      Math.max(0, index - CONTEXT),
      Math.min(rows.length, index + CONTEXT + 1),
    );
    return [header(window), ...window.map((row) => row.text)].join("\n");
  }
  return null;
}
