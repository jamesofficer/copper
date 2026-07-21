import { Badge, Box, Flex, HStack, Text } from "@chakra-ui/react";
import { useMemo } from "react";
import type { ReviewComment } from "../../../shared/types";
import { type DiffLine, languageForPath, parsePatch } from "../lib/diffParser";
import { formatThreadRange, type ReviewThread } from "../lib/reviewComments";
import { scrollbar } from "../lib/scrollbar";
import { tokenColors } from "../lib/syntaxColors";
import DiffCommentThread from "./DiffCommentThread";

interface Props {
  thread: ReviewThread;
  repo: string;
  prNumber: number;
}

const lineStyles: Record<string, { bg: string; sign: string }> = {
  add: { bg: "green.subtle", sign: "+" },
  del: { bg: "red.subtle", sign: "-" },
  context: { bg: "transparent", sign: " " },
};

// The excerpt ends at the comment's anchor line, so keeping the tail shows
// the commented range plus a little context.
function trimHunk(root: ReviewComment, lines: DiffLine[]): DiffLine[] {
  const rows = lines.filter((line) => line.kind in lineStyles);
  const range =
    root.line !== null && root.startLine !== null
      ? root.line - root.startLine + 1
      : 1;
  return rows.slice(-Math.max(4, range));
}

// An inline review thread shown in the Overview's conversation: where it was
// left, the code it points at, and the discussion itself.
export default function ReviewThreadCard({ thread, repo, prNumber }: Props) {
  const { root } = thread;
  const range = formatThreadRange(root);

  const hunkLines = useMemo(
    () =>
      root.diffHunk
        ? trimHunk(root, parsePatch(root.diffHunk, languageForPath(root.path)))
        : [],
    [root],
  );

  return (
    <Box borderWidth="1px" rounded="lg" overflow="hidden">
      <HStack
        px="3"
        py="2"
        gap="2"
        bg="bg.subtle"
        borderBottomWidth="1px"
        fontSize="xs"
        flexWrap="wrap"
      >
        <Text fontFamily="mono" wordBreak="break-all">
          {root.path}
        </Text>
        {range ? (
          <Text color="fg.muted" flexShrink="0">
            {range}
          </Text>
        ) : (
          <Badge size="sm" variant="surface" colorPalette="orange">
            Outdated
          </Badge>
        )}
      </HStack>

      {hunkLines.length > 0 && (
        <Box
          overflowX="auto"
          borderBottomWidth="1px"
          css={[scrollbar, tokenColors]}
          fontFamily="'JetBrains Mono', monospace"
          fontSize="13px"
          lineHeight="1.6"
        >
          <Box minW="max-content" py="1">
            {hunkLines.map((line, index) => {
              const style = lineStyles[line.kind];
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: hunk lines have no stable id
                <Flex key={index} bg={style.bg}>
                  <Text
                    as="span"
                    w="12"
                    flexShrink="0"
                    px="2"
                    textAlign="right"
                    color="fg.subtle"
                    userSelect="none"
                  >
                    {line.newNumber ?? line.oldNumber ?? ""}
                  </Text>
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
                </Flex>
              );
            })}
          </Box>
        </Box>
      )}

      <Box p="3">
        <DiffCommentThread thread={thread} repo={repo} prNumber={prNumber} />
      </Box>
    </Box>
  );
}
