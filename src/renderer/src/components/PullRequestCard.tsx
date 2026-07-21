import { Badge, Box, HStack, Text, VStack } from "@chakra-ui/react";
import { LuMessageSquare } from "react-icons/lu";
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
  // Highlight the card while its PR is open in the preview panel.
  selected?: boolean;
  showRepo?: boolean;
  viewedAt?: string;
  maxW?: string;
  // The PR's cached analysis is for an older commit than its current head.
  analysisOutdated?: boolean;
}

export default function PullRequestCard({
  pr,
  detail,
  onSelect,
  selected,
  showRepo,
  viewedAt,
  maxW,
  analysisOutdated,
}: Props) {
  const title = detail?.title ?? pr.title;
  const draft = detail?.draft ?? pr.draft;
  const reviewStatus = detail?.reviewStatus ?? pr.reviewStatus;
  const additions = detail?.additions ?? pr.additions;
  const deletions = detail?.deletions ?? pr.deletions;
  const changedFiles = detail?.changedFiles ?? pr.changedFiles;
  const comments = detail?.comments ?? pr.comments;
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
      bg={selected ? "bg.subtle" : undefined}
      borderColor={selected ? "colorPalette.muted" : undefined}
      _hover={{ bg: "bg.subtle", borderColor: "colorPalette.muted" }}
    >
      <HStack justifyContent="space-between" gap="4" alignItems="flex-start">
        <VStack gap="1" alignItems="flex-start" minW="0">
          <HStack gap="1.5" flexWrap="wrap">
            <PrStateBadge state={state} draft={draft} merged={merged} />
            {shouldShowReviewStatus(state, merged, reviewStatus) && (
              <ReviewStatusBadge status={reviewStatus} />
            )}
            {analysisOutdated && (
              <Badge colorPalette="orange" variant="surface">
                Analysis outdated
              </Badge>
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
            {comments > 0 && (
              <HStack gap="1">
                <LuMessageSquare size={12} />
                <Text>{comments}</Text>
              </HStack>
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
