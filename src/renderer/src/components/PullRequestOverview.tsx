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
import type {
  PullRequest,
  PullRequestComment,
  PullRequestReview,
  ReviewComment,
} from "../../../shared/types";
import { formatDate } from "../lib/formatDate";
import { labelPalette } from "../lib/labelColor";
import { listReviewThreads, type ReviewThread } from "../lib/reviewComments";
import { scrollbar } from "../lib/scrollbar";
import BaseBranchSelect from "./BaseBranchSelect";
import CommentCard from "./CommentCard";
import CommentComposer from "./CommentComposer";
import Markdown from "./Markdown";
import PrStateBadge from "./PrStateBadge";
import ReviewCard from "./ReviewCard";
import ReviewStatusBadge, { shouldShowReviewStatus } from "./ReviewStatusBadge";
import ReviewSummary from "./ReviewSummary";
import ReviewThreadCard from "./ReviewThreadCard";
import UserAvatar from "./UserAvatar";

interface Props {
  pr: PullRequest;
}

type TimelineItem =
  | { kind: "comment"; date: string; comment: PullRequestComment }
  | { kind: "review"; date: string; review: PullRequestReview }
  | { kind: "thread"; date: string; thread: ReviewThread };

// Merge conversation comments, meaningful review events, and inline review
// threads into one oldest-first thread. Reviews only appear when they carry
// a verdict or a written comment — bare "commented" reviews and dismissals
// are noise here.
function buildTimeline(
  comments: PullRequestComment[],
  reviews: PullRequestReview[],
  reviewComments: ReviewComment[],
): TimelineItem[] {
  const items: TimelineItem[] = comments.map((comment) => ({
    kind: "comment",
    date: comment.createdAt,
    comment,
  }));

  for (const review of reviews) {
    const meaningful =
      review.state === "approved" ||
      review.state === "changes_requested" ||
      (review.state === "commented" && review.body.trim().length > 0);
    if (meaningful) {
      items.push({ kind: "review", date: review.submittedAt, review });
    }
  }

  for (const thread of listReviewThreads(reviewComments)) {
    items.push({ kind: "thread", date: thread.root.createdAt, thread });
  }

  return items.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
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

  const reviewsQuery = useQuery({
    queryKey: ["pullRequestReviews", pr.repo, pr.number],
    queryFn: () => window.api.listPullRequestReviews(pr.repo, pr.number),
  });
  const reviews = reviewsQuery.data ?? [];

  const reviewCommentsQuery = useQuery({
    queryKey: ["reviewComments", pr.repo, pr.number],
    queryFn: () => window.api.listReviewComments(pr.repo, pr.number),
  });
  const reviewComments = reviewCommentsQuery.data ?? [];

  // Resolution comes from a separate GraphQL lookup; if it fails, threads
  // simply all show as unresolved.
  const resolvedQuery = useQuery({
    queryKey: ["resolvedThreads", pr.repo, pr.number],
    queryFn: () => window.api.listResolvedReviewThreads(pr.repo, pr.number),
  });
  const resolvedIds = new Set(resolvedQuery.data ?? []);

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
  const timeline = comments
    ? buildTimeline(comments, reviews, reviewComments)
    : [];

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
            <BaseBranchSelect detail={detail} />
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
                colorPalette={labelPalette(label.color)}
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

        <ReviewSummary
          reviews={reviews}
          requestedReviewers={detail.reviewers}
        />

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
                Conversation ({timeline.length})
              </Heading>
              <VStack gap="3" alignItems="stretch">
                {timeline.map((item) =>
                  item.kind === "comment" ? (
                    <CommentCard
                      key={`comment-${item.comment.id}`}
                      comment={item.comment}
                    />
                  ) : item.kind === "review" ? (
                    <ReviewCard
                      key={`review-${item.review.id}`}
                      review={item.review}
                    />
                  ) : (
                    <ReviewThreadCard
                      key={`thread-${item.thread.root.id}`}
                      thread={item.thread}
                      repo={pr.repo}
                      prNumber={pr.number}
                      resolved={resolvedIds.has(item.thread.root.id)}
                    />
                  ),
                )}
                <Box mt={timeline.length > 0 ? "3" : "0"}>
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
