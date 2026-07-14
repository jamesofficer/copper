import { Badge, Box, HStack, Text, VStack } from "@chakra-ui/react";
import type { PullRequest } from "../../../shared/types";
import { timeAgo } from "../lib/recentPrs";

interface Props {
  pr: PullRequest;
  onSelect(pr: PullRequest): void;
  showRepo?: boolean;
  viewedAt?: string;
}

export default function PullRequestCard({
  pr,
  onSelect,
  showRepo,
  viewedAt,
}: Props) {
  return (
    <Box
      as="button"
      onClick={() => onSelect(pr)}
      textAlign="left"
      borderWidth="1px"
      rounded="lg"
      px="5"
      py="4"
      cursor="pointer"
      transition="backgrounds"
      _hover={{ bg: "bg.subtle", borderColor: "colorPalette.muted" }}
    >
      <HStack justifyContent="space-between" gap="4" alignItems="flex-start">
        <VStack gap="1" alignItems="flex-start" minW="0">
          <Text fontWeight="semibold" wordBreak="break-word">
            {pr.title}
          </Text>
          <HStack
            fontFamily="mono"
            fontSize="xs"
            color="fg.muted"
            gap="3"
            flexWrap="wrap"
          >
            <Text>
              {showRepo ? `${pr.repo}#${pr.number}` : `#${pr.number}`}
            </Text>
            <Text>{pr.author}</Text>
            {viewedAt ? (
              <Text>{timeAgo(viewedAt)}</Text>
            ) : (
              <Text>{pr.changedFiles} files</Text>
            )}
          </HStack>
        </VStack>
        <HStack fontFamily="mono" fontSize="xs" gap="2" flexShrink="0">
          <Badge colorPalette="green" variant="surface">
            +{pr.additions}
          </Badge>
          <Badge colorPalette="red" variant="surface">
            −{pr.deletions}
          </Badge>
        </HStack>
      </HStack>
    </Box>
  );
}
