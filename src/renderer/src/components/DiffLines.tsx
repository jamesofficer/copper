import { Box, Flex, Text } from "@chakra-ui/react";
import { useMemo } from "react";
import type { PullRequestFile } from "../../../shared/types";
import { type LineKind, languageForPath, parsePatch } from "../lib/diffParser";

interface Props {
  file: PullRequestFile;
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

// Renders a file's patch as diff rows. Sizing and scrolling are the parent's
// job, so this can live in a full pane (DiffView) or an embedded card.
export default function DiffLines({ file }: Props) {
  const language = languageForPath(file.path);
  const lines = useMemo(
    () => (file.patch ? parsePatch(file.patch, language) : []),
    [file.patch, language],
  );

  return (
    <Box
      fontFamily="'JetBrains Mono', monospace"
      fontSize="14px"
      lineHeight="1.6"
      css={tokenColors}
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
