import hljs from "highlight.js/lib/common";

export type LineKind = "hunk" | "add" | "del" | "context" | "meta";

export interface DiffLine {
  kind: LineKind;
  oldNumber: number | null;
  newNumber: number | null;
  text: string;
  html: string;
}

const extToLanguage: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  css: "css",
  scss: "scss",
  less: "less",
  html: "xml",
  xml: "xml",
  svg: "xml",
  vue: "xml",
  md: "markdown",
  markdown: "markdown",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  swift: "swift",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
  ini: "ini",
  sql: "sql",
  lua: "lua",
  r: "r",
};

export function languageForPath(path: string): string | null {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return null;
  const language = extToLanguage[path.slice(dot + 1).toLowerCase()];
  return language && hljs.getLanguage(language) ? language : null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlight(text: string, language: string | null): string {
  if (!text) return "";
  if (language) {
    try {
      return hljs.highlight(text, { language, ignoreIllegals: true }).value;
    } catch {
      // fall back to plain text below
    }
  }
  return escapeHtml(text);
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

export function parsePatch(patch: string, language: string | null): DiffLine[] {
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
        html: highlight(text, language),
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
        html: highlight(text, language),
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
      html: highlight(text, language),
    });
    oldNumber++;
    newNumber++;
  }

  return lines;
}
