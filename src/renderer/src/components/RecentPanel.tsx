import { Button, Flex, Heading, HStack, Stack } from "@chakra-ui/react";
import { useState } from "react";
import { LuHistory } from "react-icons/lu";
import type { PullRequest } from "../../../shared/types";
import {
  clearRecentPullRequests,
  listRecentPullRequests,
} from "../lib/recentPrs";
import { scrollbar } from "../lib/scrollbar";
import PullRequestCard from "./PullRequestCard";

interface Props {
  onSelect(pr: PullRequest): void;
}

export default function RecentPanel({ onSelect }: Props) {
  const [recent, setRecent] = useState(() => listRecentPullRequests());

  function clearRecent() {
    clearRecentPullRequests();
    setRecent([]);
  }

  if (recent.length === 0) return null;

  return (
    <Flex
      direction="column"
      w="sm"
      flexShrink="0"
      minH="0"
      borderLeftWidth="1px"
    >
      <HStack justifyContent="space-between" px="4" py="2" flexShrink="0">
        <HStack gap="2" color="fg.muted">
          <LuHistory size={13} />
          <Heading
            size="xs"
            textTransform="uppercase"
            letterSpacing="wider"
            color="fg.muted"
          >
            Recently viewed
          </Heading>
        </HStack>
        <Button
          size="xs"
          variant="ghost"
          color="fg.muted"
          onClick={clearRecent}
        >
          Clear
        </Button>
      </HStack>

      <Stack
        flex="1"
        minH="0"
        overflowY="auto"
        gap="3"
        px="4"
        pb="4"
        css={scrollbar}
      >
        {recent.map((pr) => (
          <PullRequestCard
            key={`${pr.repo}#${pr.number}`}
            pr={pr}
            onSelect={onSelect}
            showRepo
            viewedAt={pr.viewedAt}
          />
        ))}
      </Stack>
    </Flex>
  );
}
