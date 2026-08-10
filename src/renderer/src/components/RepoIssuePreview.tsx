import { Box, Button, Flex, HStack, IconButton, Text } from "@chakra-ui/react";
import { LuExternalLink, LuX } from "react-icons/lu";
import type { RepoIssue } from "../../../shared/types";
import RepoIssueOverview from "./RepoIssueOverview";

interface Props {
  issue: RepoIssue;
  onClose(): void;
}

// The right-hand panel on the home screen's Issues tab. There's no full-screen
// issue view to hand off to, so the header offers GitHub instead of a
// "View issue" button.
export default function RepoIssuePreview({ issue, onClose }: Props) {
  return (
    <Flex
      direction="column"
      w="45%"
      minW="md"
      flexShrink="0"
      minH="0"
      borderLeftWidth="1px"
    >
      <HStack gap="3" px="4" py="2" borderBottomWidth="1px" flexShrink="0">
        <Text
          fontFamily="mono"
          fontSize="sm"
          color="fg.muted"
          truncate
          flex="1"
        >
          {issue.repo}#{issue.number}
        </Text>
        <Button asChild size="xs" variant="outline">
          <a href={issue.url} target="_blank" rel="noreferrer">
            <LuExternalLink /> Open in GitHub
          </a>
        </Button>
        <IconButton
          aria-label="Close preview"
          size="xs"
          variant="ghost"
          color="fg.muted"
          onClick={onClose}
        >
          <LuX />
        </IconButton>
      </HStack>
      <Box flex="1" minH="0">
        <RepoIssueOverview issue={issue} />
      </Box>
    </Flex>
  );
}
