import { Box, HStack, Icon, Link, Stack, Text } from "@chakra-ui/react";
import { LuGitCommitHorizontal } from "react-icons/lu";
import type { PullRequestCommit } from "../../../shared/types";
import RelativeTime from "./RelativeTime";
import UserAvatar from "./UserAvatar";

interface Props {
  repo: string;
  commits: PullRequestCommit[];
}

// A run of consecutive commits in the conversation timeline, rendered as one
// grouped block like GitHub. Each sha links to the commit on GitHub.
export default function CommitTimelineGroup({ repo, commits }: Props) {
  return (
    <HStack gap="2" align="flex-start" color="fg.muted">
      <Icon boxSize="4" flexShrink="0" mt="0.5">
        <LuGitCommitHorizontal />
      </Icon>
      <Stack gap="1.5" flex="1" minW="0">
        <Text fontSize="xs">
          added {commits.length} commit{commits.length === 1 ? "" : "s"}
        </Text>
        <Box borderWidth="1px" rounded="md" overflow="hidden">
          {commits.map((commit, index) => (
            <HStack
              key={commit.sha}
              gap="2"
              px="3"
              py="2"
              minW="0"
              borderTopWidth={index === 0 ? "0" : "1px"}
            >
              <UserAvatar username={commit.author} boxSize="3.5" />
              <Text
                fontSize="sm"
                color="fg"
                flex="1"
                truncate
                title={commit.subject}
              >
                {commit.subject}
              </Text>
              <Link
                href={`https://github.com/${repo}/commit/${commit.sha}`}
                target="_blank"
                rel="noreferrer"
                fontFamily="mono"
                fontSize="xs"
                color="fg.muted"
                flexShrink="0"
              >
                {commit.sha.slice(0, 7)}
              </Link>
              <RelativeTime
                iso={commit.date}
                fontSize="xs"
                color="fg.subtle"
                flexShrink="0"
              />
            </HStack>
          ))}
        </Box>
      </Stack>
    </HStack>
  );
}
