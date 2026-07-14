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
