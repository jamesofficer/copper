import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import c from "shiki/langs/c.mjs";
import cpp from "shiki/langs/cpp.mjs";
import csharp from "shiki/langs/csharp.mjs";
import css from "shiki/langs/css.mjs";
import diff from "shiki/langs/diff.mjs";
import go from "shiki/langs/go.mjs";
import html from "shiki/langs/html.mjs";
import ini from "shiki/langs/ini.mjs";
import java from "shiki/langs/java.mjs";
import javascript from "shiki/langs/javascript.mjs";
import json from "shiki/langs/json.mjs";
import jsx from "shiki/langs/jsx.mjs";
import kotlin from "shiki/langs/kotlin.mjs";
import less from "shiki/langs/less.mjs";
import lua from "shiki/langs/lua.mjs";
import markdown from "shiki/langs/markdown.mjs";
import php from "shiki/langs/php.mjs";
import python from "shiki/langs/python.mjs";
import r from "shiki/langs/r.mjs";
import ruby from "shiki/langs/ruby.mjs";
import rust from "shiki/langs/rust.mjs";
import scss from "shiki/langs/scss.mjs";
import shellscript from "shiki/langs/shellscript.mjs";
import sql from "shiki/langs/sql.mjs";
import swift from "shiki/langs/swift.mjs";
import toml from "shiki/langs/toml.mjs";
import tsx from "shiki/langs/tsx.mjs";
import typescript from "shiki/langs/typescript.mjs";
import vue from "shiki/langs/vue.mjs";
import xml from "shiki/langs/xml.mjs";
import yaml from "shiki/langs/yaml.mjs";
import githubDark from "shiki/themes/github-dark.mjs";
import githubLight from "shiki/themes/github-light.mjs";

const highlighter = createHighlighterCoreSync({
  themes: [githubDark, githubLight],
  langs: [
    c,
    cpp,
    csharp,
    css,
    diff,
    go,
    html,
    ini,
    java,
    javascript,
    json,
    jsx,
    kotlin,
    less,
    lua,
    markdown,
    php,
    python,
    r,
    ruby,
    rust,
    scss,
    shellscript,
    sql,
    swift,
    toml,
    tsx,
    typescript,
    vue,
    xml,
    yaml,
  ],
  // Real VS Code TextMate grammars run on JS regexes instead of the oniguruma
  // WASM build; forgiving skips the few grammar rules JS can't express rather
  // than throwing.
  engine: createJavaScriptRegexEngine({ forgiving: true }),
});

// defaultColor: false emits each token's colour for BOTH themes as CSS
// variables and nothing else, so colour mode switching is a pure CSS
// swap (see tokenColors in syntaxColors.ts) with no !important fight
// against an inline color.
//
// tokenizeMaxLineLength: TextMate grammars go superlinear on giant lines —
// a 21KB markdown paragraph took ~1s (× two themes), freezing the UI for
// seconds on a diff that touched it. Lines over the cap render plain, like
// GitHub does; real code never gets near 2,000 chars, only minified output
// and one-line prose.
const themedOptions = {
  themes: { dark: "github-dark", light: "github-light" },
  defaultColor: false,
  tokenizeMaxLineLength: 2000,
} as const;

// Loaded language ids plus their grammar aliases (ts, js, shell, …).
const knownLanguages = new Set(highlighter.getLoadedLanguages());

// Maps a markdown fence tag ("ts", "python") to a loaded language, or null.
export function resolveLanguage(
  name: string | null | undefined,
): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  return knownLanguages.has(lower) ? lower : null;
}

const extToLanguage: Record<string, string> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  json: "json",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  xml: "xml",
  svg: "xml",
  vue: "vue",
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
  sh: "shellscript",
  bash: "shellscript",
  zsh: "shellscript",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  ini: "ini",
  sql: "sql",
  lua: "lua",
  r: "r",
};

export function languageForPath(path: string): string | null {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return null;
  return extToLanguage[path.slice(dot + 1).toLowerCase()] ?? null;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface ThemedToken {
  content: string;
  htmlStyle?: Record<string, string>;
}

// Style keys/values come straight from the bundled github themes (colour
// hex codes and font styles), so they're safe inside a double-quoted attr.
function tokenHtml(token: ThemedToken): string {
  const style = Object.entries(token.htmlStyle ?? {})
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
  return `<span class="tok" style="${style}">${escapeHtml(token.content)}</span>`;
}

// Highlights a multi-line snippet and returns one HTML string per input line.
// Shiki tokenizes the document as a whole and hands the lines back already
// split, so state that spans lines (block comments, template literals)
// survives without any HTML surgery. Returns null if the language is unknown
// or the grammar fails.
export function highlightToLines(
  text: string,
  language: string,
): string[] | null {
  try {
    const { tokens } = highlighter.codeToTokens(text, {
      lang: language,
      ...themedOptions,
    });
    return tokens.map((line) => line.map(tokenHtml).join(""));
  } catch {
    return null;
  }
}

// Whole-block variant for markdown code fences.
export function highlightBlock(text: string, language: string): string | null {
  return highlightToLines(text, language)?.join("\n") ?? null;
}
