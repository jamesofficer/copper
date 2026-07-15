import {
  Badge,
  Box,
  Center,
  Heading,
  HStack,
  Separator,
  Spinner,
  Text,
  VStack,
  Wrap,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { LuGitCommitHorizontal } from "react-icons/lu";
import type { PullRequest } from "../../../shared/types";
import { scrollbar } from "../lib/scrollbar";
import CommentCard from "./CommentCard";
import CommentComposer from "./CommentComposer";
import Markdown from "./Markdown";
import PrStateBadge from "./PrStateBadge";
import ReviewStatusBadge, { shouldShowReviewStatus } from "./ReviewStatusBadge";
import UserAvatar from "./UserAvatar";

interface Props {
  pr: PullRequest;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PullRequestOverview({ pr }: Props) {
  const detailQuery = useQuery({
    queryKey: ["pullRequest", pr.repo, pr.number],
    queryFn: () => window.api.getPullRequest(pr.repo, pr.number),
  });

  const commentsQuery = useQuery({
    queryKey: ["pullRequestComments", pr.repo, pr.number],
    queryFn: () => window.api.listPullRequestComments(pr.repo, pr.number),
  });
  const comments = commentsQuery.data;

  if (detailQuery.isPending) {
    return (
      <Center h="full">
        <HStack color="fg.muted">
          <Spinner size="sm" />
          <Text fontSize="sm">Loading pull request…</Text>
        </HStack>
      </Center>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <Center h="full" p="8">
        <Text fontSize="sm" color="fg.error" textAlign="center">
          {detailQuery.error instanceof Error
            ? detailQuery.error.message
            : "Couldn't load this pull request."}
        </Text>
      </Center>
    );
  }

  const detail = detailQuery.data;

  return (
    <Box h="full" overflowY="auto" css={scrollbar}>
      <VStack gap="6" alignItems="stretch" maxW="3xl" mx="auto" px="8" py="8">
        <VStack gap="3" alignItems="stretch">
          <HStack gap="1.5">
            <PrStateBadge
              state={detail.state}
              draft={detail.draft}
              merged={detail.merged}
              size="lg"
            />
            {shouldShowReviewStatus(
              detail.state,
              detail.merged,
              detail.reviewStatus,
            ) && <ReviewStatusBadge status={detail.reviewStatus} size="lg" />}
          </HStack>
          <Heading size="lg" lineHeight="1.3">
            {detail.title}
          </Heading>

          <HStack
            fontFamily="mono"
            fontSize="sm"
            color="fg.muted"
            gap="2"
            flexWrap="wrap"
          >
            <Text>#{detail.number}</Text>
            <Text>·</Text>
            <HStack gap="1.5">
              <UserAvatar username={detail.author} />
              <Text color="fg">{detail.author}</Text>
            </HStack>
            <Text>wants to merge into</Text>
            <Badge variant="outline">{detail.baseRef}</Badge>
            <Text>from</Text>
            <Badge variant="outline">{detail.headRef}</Badge>
          </HStack>
        </VStack>

        {detail.labels.length > 0 && (
          <Wrap gap="2">
            {detail.labels.map((label) => (
              <Badge
                key={label.name}
                variant="surface"
                style={{
                  borderColor: `#${label.color}`,
                  color: `#${label.color}`,
                }}
              >
                {label.name}
              </Badge>
            ))}
          </Wrap>
        )}

        <HStack
          fontFamily="mono"
          fontSize="sm"
          gap="5"
          flexWrap="wrap"
          color="fg.muted"
        >
          <HStack gap="1.5">
            <LuGitCommitHorizontal />
            <Text>
              {detail.commits} commit{detail.commits === 1 ? "" : "s"}
            </Text>
          </HStack>
          <Text>
            {detail.changedFiles} file{detail.changedFiles === 1 ? "" : "s"}
          </Text>
          <HStack gap="2">
            <Text color="green.fg">+{detail.additions}</Text>
            <Text color="red.fg">−{detail.deletions}</Text>
          </HStack>
        </HStack>

        {detail.reviewers.length > 0 && (
          <HStack fontSize="sm" gap="2" flexWrap="wrap">
            <Text color="fg.muted">Reviewers</Text>
            {detail.reviewers.map((reviewer) => (
              <Badge key={reviewer} variant="subtle" fontFamily="mono">
                <UserAvatar username={reviewer} boxSize="3.5" />
                {reviewer}
              </Badge>
            ))}
          </HStack>
        )}

        <Separator />

        <Box>
          <Heading
            size="xs"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="wider"
            mb="3"
          >
            Description
          </Heading>
          {detail.body?.trim() ? (
            <Markdown>{detail.body}</Markdown>
          ) : (
            <Text fontSize="sm" color="fg.muted" fontStyle="italic">
              No description provided.
            </Text>
          )}
        </Box>

        {comments && (
          <>
            <Separator />
            <Box>
              <Heading
                size="xs"
                color="fg.muted"
                textTransform="uppercase"
                letterSpacing="wider"
                mb="3"
              >
                Comments ({comments.length})
              </Heading>
              <VStack gap="3" alignItems="stretch">
                {comments.map((comment) => (
                  <CommentCard key={comment.id} comment={comment} />
                ))}
                <Box mt={comments.length > 0 ? "3" : "0"}>
                  <Heading
                    size="xs"
                    color="fg.muted"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    mb="3"
                  >
                    Add a comment
                  </Heading>
                  <CommentComposer pr={pr} />
                </Box>
              </VStack>
            </Box>
          </>
        )}

        <Separator />

        <HStack fontSize="xs" color="fg.subtle" gap="4" flexWrap="wrap">
          <Text>Opened {formatDate(detail.createdAt)}</Text>
          <Text>Updated {formatDate(detail.updatedAt)}</Text>
        </HStack>
      </VStack>
    </Box>
  );
}
