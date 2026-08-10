import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { LuCircleDot } from "react-icons/lu";
import type { RepoIssue } from "../../../shared/types";
import CommentCountBadge from "./CommentCountBadge";
import LabelBadges from "./LabelBadges";
import RelativeTime from "./RelativeTime";
import UserAvatar from "./UserAvatar";

interface Props {
  issue: RepoIssue;
  onSelect(issue: RepoIssue): void;
  // Highlight the card while its issue is open in the preview panel.
  selected?: boolean;
  maxW?: string;
}

// Its own component rather than a widened PullRequestCard: the PR card's
// state, review status and diff counts have no issue equivalent, so sharing
// one would leave a card made of optional props.
export default function RepoIssueCard({
  issue,
  onSelect,
  selected,
  maxW,
}: Props) {
  return (
    <Box
      as="button"
      onClick={() => onSelect(issue)}
      maxW={maxW}
      textAlign="left"
      borderWidth="1px"
      rounded="lg"
      px="5"
      py="4"
      cursor="pointer"
      transition="background 0.12s, border-color 0.12s"
      bg={selected ? "bg.subtle" : undefined}
      borderColor={selected ? "colorPalette.solid" : undefined}
      _hover={{
        bg: "bg.subtle",
        borderColor: selected ? "colorPalette.solid" : "colorPalette.muted",
      }}
    >
      <HStack justifyContent="space-between" gap="4" alignItems="flex-start">
        <VStack gap="1.5" alignItems="flex-start" minW="0">
          <HStack gap="2" alignItems="flex-start">
            <Box color="green.fg" mt="0.5" flexShrink="0">
              <LuCircleDot size={14} />
            </Box>
            <Text fontWeight="semibold" wordBreak="break-word">
              {issue.title}
            </Text>
          </HStack>
          <HStack
            fontFamily="mono"
            fontSize="xs"
            color="fg.muted"
            gap="3"
            flexWrap="wrap"
          >
            <Text>#{issue.number}</Text>
            <HStack gap="1.5">
              <UserAvatar username={issue.author} boxSize="3.5" />
              <Text>{issue.author}</Text>
            </HStack>
            <Text>
              opened <RelativeTime iso={issue.createdAt} />
            </Text>
          </HStack>
          <LabelBadges labels={issue.labels} size="sm" />
        </VStack>
        <Box flexShrink="0" fontFamily="mono" fontSize="xs">
          <CommentCountBadge count={issue.comments} />
        </Box>
      </HStack>
    </Box>
  );
}
