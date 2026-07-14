import { Box, Center, Flex, Text } from "@chakra-ui/react";
import hljs from "highlight.js/lib/common";
import { useMemo } from "react";
import type { PullRequestFile } from "../../../shared/types";
import { scrollbar } from "../lib/scrollbar";

interface Props {
  file: PullRequestFile;
}

type LineKind = "hunk" | "add" | "del" | "context" | "meta";

interface DiffLine {
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

function languageForPath(path: string): string | null {
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

function parsePatch(patch: string, language: string | null): DiffLine[] {
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

const rowStyles: Record<LineKind, { bg: string; sign: string }> = {
  add: { bg: "green.subtle", sign: "+" },
  del: { bg: "red.subtle", sign: "-" },
  context: { bg: "transparent", sign: " " },
  hunk: { bg: "bg.muted", sign: "" },
  meta: { bg: "transparent", sign: "" },
};

// github-dark token palette, applied to highlight.js output
const tokenColors = {
  "& .hljs-keyword, & .hljs-built_in": { color: "#ff7b72" },
  "& .hljs-string, & .hljs-regexp, & .hljs-char.escape_": { color: "#a5d6ff" },
  "& .hljs-comment, & .hljs-quote": { color: "#8b949e", fontStyle: "italic" },
  "& .hljs-number, & .hljs-literal": { color: "#79c0ff" },
  "& .hljs-title, & .hljs-title.function_, & .hljs-title.class_": {
    color: "#d2a8ff",
  },
  "& .hljs-attr, & .hljs-attribute, & .hljs-variable, & .hljs-property": {
    color: "#79c0ff",
  },
  "& .hljs-tag, & .hljs-name, & .hljs-selector-tag": { color: "#7ee787" },
  "& .hljs-type, & .hljs-symbol, & .hljs-bullet": { color: "#ffa657" },
  "& .hljs-meta": { color: "#8b949e" },
} as const;

function Gutter({ value }: { value: number | null }) {
  return (
    <Text
      as="span"
      w="12"
      flexShrink="0"
      px="2"
      textAlign="right"
      color="fg.subtle"
      userSelect="none"
    >
      {value ?? ""}
    </Text>
  );
}

export default function DiffView({ file }: Props) {
  const language = languageForPath(file.path);
  const lines = useMemo(
    () => (file.patch ? parsePatch(file.patch, language) : []),
    [file.patch, language],
  );

  if (!file.patch) {
    return (
      <Center h="full" p="8">
        <Text color="fg.muted" fontSize="sm" textAlign="center">
          {file.status === "renamed"
            ? "File renamed with no content changes."
            : "No text diff available — this file is binary or too large to show."}
        </Text>
      </Center>
    );
  }

  return (
    <Box
      h="full"
      overflow="auto"
      fontFamily="'JetBrains Mono', monospace"
      fontSize="14px"
      lineHeight="1.6"
      css={{ ...scrollbar, ...tokenColors }}
    >
      {lines.map((line, index) => {
        const style = rowStyles[line.kind];
        return (
          <Flex
            // biome-ignore lint/suspicious/noArrayIndexKey: patch lines have no stable id
            key={index}
            bg={style.bg}
            color={line.kind === "hunk" ? "fg.muted" : "fg"}
            minW="max-content"
          >
            {line.kind === "hunk" || line.kind === "meta" ? (
              <Text as="span" px="3" py="0.5" whiteSpace="pre">
                {line.text}
              </Text>
            ) : (
              <>
                <Gutter value={line.oldNumber} />
                <Gutter value={line.newNumber} />
                <Text
                  as="span"
                  w="4"
                  flexShrink="0"
                  textAlign="center"
                  color="fg.subtle"
                  userSelect="none"
                >
                  {style.sign}
                </Text>
                <Text
                  as="span"
                  flex="1"
                  pr="4"
                  whiteSpace="pre"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: highlight.js output is escaped
                  dangerouslySetInnerHTML={{ __html: line.html }}
                />
              </>
            )}
          </Flex>
        );
      })}
    </Box>
  );
}
