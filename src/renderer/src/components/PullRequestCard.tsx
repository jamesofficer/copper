import { Badge, Box, HStack, Text, VStack } from "@chakra-ui/react";
import type { PullRequest, PullRequestDetail } from "../../../shared/types";
import { timeAgo } from "../lib/recentPrs";
import PrStateBadge from "./PrStateBadge";
import ReviewStatusBadge, { shouldShowReviewStatus } from "./ReviewStatusBadge";
import UserAvatar from "./UserAvatar";

interface Props {
  pr: PullRequest;
  // Live PR data, when the caller has it. Recently-viewed cards render from a
  // stored snapshot that can be stale (merged since, approved since) — fields
  // here win over the snapshot.
  detail?: PullRequestDetail;
  onSelect(pr: PullRequest): void;
  showRepo?: boolean;
  viewedAt?: string;
  maxW?: string;
}

export default function PullRequestCard({
  pr,
  detail,
  onSelect,
  showRepo,
  viewedAt,
  maxW,
}: Props) {
  const title = detail?.title ?? pr.title;
  const draft = detail?.draft ?? pr.draft;
  const reviewStatus = detail?.reviewStatus ?? pr.reviewStatus;
  const additions = detail?.additions ?? pr.additions;
  const deletions = detail?.deletions ?? pr.deletions;
  const changedFiles = detail?.changedFiles ?? pr.changedFiles;
  // The snapshot only ever holds open PRs, so without fresh detail assume open.
  const state = detail?.state ?? "open";
  const merged = detail?.merged ?? false;

  return (
    <Box
      as="button"
      onClick={() => onSelect(pr)}
      maxW={maxW}
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
          <HStack gap="1.5" flexWrap="wrap">
            <PrStateBadge state={state} draft={draft} merged={merged} />
            {shouldShowReviewStatus(state, merged, reviewStatus) && (
              <ReviewStatusBadge status={reviewStatus} />
            )}
          </HStack>
          <Text fontWeight="semibold" wordBreak="break-word">
            {title}
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
            <HStack gap="1.5">
              <UserAvatar username={pr.author} boxSize="3.5" />
              <Text>{pr.author}</Text>
            </HStack>
            {viewedAt ? (
              <Text>{timeAgo(viewedAt)}</Text>
            ) : (
              <Text>{changedFiles} files</Text>
            )}
          </HStack>
        </VStack>
        <HStack fontFamily="mono" fontSize="xs" gap="2" flexShrink="0">
          <Badge colorPalette="green" variant="surface">
            +{additions}
          </Badge>
          <Badge colorPalette="red" variant="surface">
            −{deletions}
          </Badge>
        </HStack>
      </HStack>
    </Box>
  );
}
