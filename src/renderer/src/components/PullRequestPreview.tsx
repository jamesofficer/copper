import { Box, Button, Flex, HStack, IconButton, Text } from "@chakra-ui/react";
import { LuExternalLink, LuX } from "react-icons/lu";
import type { PullRequest } from "../../../shared/types";
import { dragRegion, titleBarHeight } from "../lib/titleBar";
import type { ReviewTab } from "../screens/Review";
import PullRequestOverview from "./PullRequestOverview";

interface Props {
  pr: PullRequest;
  // Leave the preview and open the PR's full review screen, on the tab the
  // button that called this one names.
  onView(pr: PullRequest, tab: ReviewTab): void;
  onClose(): void;
}

// The right-hand panel on the home screen: a quick look at a PR's Overview
// without leaving the PR lists.
export default function PullRequestPreview({ pr, onView, onClose }: Props) {
  return (
    <Flex direction="column" flex="1" minW="0" minH="0">
      {/* Same height as the queue's header, so the two line up across the top
          of the window. */}
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
          {pr.repo}
        </Text>
        <Button asChild size="xs" variant="outline">
          <a href={pr.url} target="_blank" rel="noreferrer">
            View on GitHub <LuExternalLink />
          </a>
        </Button>
        {/* The panel's one primary action: this is the button that takes the
            reviewer from skimming to reviewing, so it opens the diff rather
            than a second copy of the overview they've just read. */}
        <Button size="xs" onClick={() => onView(pr, "changes")}>
          Review changes
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
        <PullRequestOverview pr={pr} />
      </Box>
    </Flex>
  );
}
