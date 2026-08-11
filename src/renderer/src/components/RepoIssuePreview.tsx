import { Box, Button, Flex, HStack, IconButton, Text } from "@chakra-ui/react";
import { LuExternalLink, LuX } from "react-icons/lu";
import type { RepoIssue } from "../../../shared/types";
import { dragRegion, titleBarHeight } from "../lib/titleBar";
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
    <Flex direction="column" flex="1" minW="0" minH="0">
      <HStack
        gap="3"
        px="4"
        h={titleBarHeight}
        borderBottomWidth="1px"
        flexShrink="0"
        css={dragRegion}
      >
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
