import { Box, HStack, Text } from "@chakra-ui/react";
import type { LocalCommit } from "../../../shared/types";
import { scrollbar } from "../lib/scrollbar";
import RelativeTime from "./RelativeTime";

interface Props {
  commit: LocalCommit;
}

// A commit's own message above its diff — the author's account of what the
// diff is for, which is the whole reason to read history commit by commit. It
// scrolls within a cap of its own, so a long message can never push the diff
// off the screen.
export default function CommitMessageHeader({ commit }: Props) {
  return (
    <Box
      px="4"
      py="3"
      flexShrink="0"
      borderBottomWidth="1px"
      maxH="30%"
      overflowY="auto"
      css={scrollbar}
    >
      <Text fontSize="sm" fontWeight="semibold">
        {commit.subject}
      </Text>
      <HStack gap="2" mt="1" color="fg.muted" fontSize="xs">
        <Text as="span" fontFamily="mono">
          {commit.sha.slice(0, 7)}
        </Text>
        <Text as="span">{commit.author}</Text>
        <RelativeTime iso={commit.date} color="fg.subtle" />
      </HStack>
      {commit.body && (
        <Text
          mt="2"
          fontSize="xs"
          color="fg.muted"
          whiteSpace="pre-wrap"
          fontFamily="mono"
        >
          {commit.body}
        </Text>
      )}
    </Box>
  );
}
