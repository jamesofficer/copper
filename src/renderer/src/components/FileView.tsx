import { Box, Flex, Text } from "@chakra-ui/react";
import { useMemo } from "react";
import {
  escapeHtml,
  highlightToLines,
  languageForPath,
} from "../lib/diffParser";
import { syntaxBackground, tokenColors } from "../lib/syntaxColors";
import { useSyntaxThemes } from "../lib/syntaxTheme";
import { diffFontStyles } from "./DiffLines";

interface Props {
  path: string;
  text: string;
}

// Read-only listing of the whole file at the diff's commit — same font and
// syntax palette as the diff rows, minus the diff chrome.
export default function FileView({ path, text }: Props) {
  const themes = useSyntaxThemes();
  const rows = useMemo(() => {
    const language = languageForPath(path);
    const lines = text.split("\n");
    if (lines.at(-1) === "") lines.pop();
    const html = language ? highlightToLines(text, language, themes) : null;
    return lines.map((line, index) => html?.[index] ?? escapeHtml(line));
  }, [path, text, themes]);

  return (
    <Box
      {...diffFontStyles}
      css={[tokenColors, syntaxBackground(themes)]}
      minW="max-content"
    >
      {rows.map((html, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the index IS the line number
        <Flex key={index}>
          <Text
            as="span"
            w="12"
            flexShrink="0"
            px="2"
            textAlign="right"
            color="fg.subtle"
            userSelect="none"
          >
            {index + 1}
          </Text>
          <Text
            as="span"
            flex="1"
            pr="4"
            whiteSpace="pre"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: highlighter output is escaped
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </Flex>
      ))}
    </Box>
  );
}
