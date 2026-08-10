import {
  Badge,
  Box,
  Heading,
  HStack,
  Separator,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { LuGitCommitHorizontal } from "react-icons/lu";
import type {
  PullRequest,
  PullRequestComment,
  PullRequestCommit,
  PullRequestReview,
  ReviewComment,
} from "../../../shared/types";
import { listReviewThreads, type ReviewThread } from "../lib/reviewComments";
import { scrollbar } from "../lib/scrollbar";
import BaseBranchSelect from "./BaseBranchSelect";
import CommentCard from "./CommentCard";
import CommentComposer from "./CommentComposer";
import CommitTimelineGroup from "./CommitTimelineGroup";
import LabelBadges from "./LabelBadges";
import OpenedUpdatedLine from "./OpenedUpdatedLine";
import { PanelError, PanelLoading } from "./PanelState";
import PrStateBadge from "./PrStateBadge";
import PullRequestDescription from "./PullRequestDescription";
import ReviewCard from "./ReviewCard";
import ReviewStatusBadge, { shouldShowReviewStatus } from "./ReviewStatusBadge";
import ReviewSummary from "./ReviewSummary";
import ReviewThreadCard from "./ReviewThreadCard";
import SectionHeading from "./SectionHeading";
import UserAvatar from "./UserAvatar";

interface Props {
  pr: PullRequest;
  // PR actions (close/reopen) only show in the full review screen, not the
  // home-screen preview panel.
  showActions?: boolean;
}

type TimelineItem =
  | { kind: "comment"; date: string; comment: PullRequestComment }
  | { kind: "review"; date: string; review: PullRequestReview }
  | { kind: "thread"; date: string; thread: ReviewThread }
  | { kind: "commit"; date: string; commit: PullRequestCommit };

// Consecutive commits in the timeline are collapsed into one grouped block,
// like GitHub.
type RenderItem =
  | Exclude<TimelineItem, { kind: "commit" }>
  | { kind: "commits"; commits: PullRequestCommit[] };

// Merge conversation comments, meaningful review events, inline review threads,
// and commits into one oldest-first thread. Reviews only appear when they carry
// a verdict or a written comment — bare "commented" reviews and dismissals
// are noise here.
function buildTimeline(
  comments: PullRequestComment[],
  reviews: PullRequestReview[],
  reviewComments: ReviewComment[],
  commits: PullRequestCommit[],
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

  for (const commit of commits) {
    items.push({ kind: "commit", date: commit.date, commit });
  }

  return items.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

// Collapse runs of consecutive commits in the sorted timeline into single
// grouped blocks.
function groupTimeline(items: TimelineItem[]): RenderItem[] {
  const grouped: RenderItem[] = [];
  for (const item of items) {
    const last = grouped[grouped.length - 1];
    if (item.kind === "commit") {
      if (last?.kind === "commits") {
        last.commits.push(item.commit);
      } else {
        grouped.push({ kind: "commits", commits: [item.commit] });
      }
    } else {
      grouped.push(item);
    }
  }
  return grouped;
}

export default function PullRequestOverview({ pr, showActions }: Props) {
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

  const commitsQuery = useQuery({
    queryKey: ["pullRequestCommits", pr.repo, pr.number],
    queryFn: () => window.api.listPullRequestCommits(pr.repo, pr.number),
  });
  const commits = commitsQuery.data ?? [];

  // Resolution comes from a separate GraphQL lookup; if it fails, threads
  // simply all show as unresolved.
  const resolvedQuery = useQuery({
    queryKey: ["resolvedThreads", pr.repo, pr.number],
    queryFn: () => window.api.listResolvedReviewThreads(pr.repo, pr.number),
  });
  const resolvedIds = new Set(resolvedQuery.data ?? []);

  if (detailQuery.isPending) {
    return <PanelLoading label="Loading pull request…" />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <PanelError
        message={
          detailQuery.error instanceof Error
            ? detailQuery.error.message
            : "Couldn't load this pull request."
        }
      />
    );
  }

  const detail = detailQuery.data;
  const timeline = comments
    ? buildTimeline(comments, reviews, reviewComments, commits)
    : [];
  const rendered = groupTimeline(timeline);
  // The header count reflects discussion, not commits.
  const discussionCount = timeline.filter(
    (item) => item.kind !== "commit",
  ).length;

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

        <LabelBadges labels={detail.labels} />

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

        <PullRequestDescription detail={detail} editable={showActions} />

        {comments && (
          <>
            <Separator />
            <Box>
              <SectionHeading>Conversation ({discussionCount})</SectionHeading>
              <VStack gap="3" alignItems="stretch">
                {rendered.map((item) =>
                  item.kind === "comment" ? (
                    <CommentCard
                      key={`comment-${item.comment.id}`}
                      comment={item.comment}
                      repo={pr.repo}
                      number={pr.number}
                    />
                  ) : item.kind === "review" ? (
                    <ReviewCard
                      key={`review-${item.review.id}`}
                      review={item.review}
                    />
                  ) : item.kind === "thread" ? (
                    <ReviewThreadCard
                      key={`thread-${item.thread.root.id}`}
                      thread={item.thread}
                      repo={pr.repo}
                      prNumber={pr.number}
                      resolved={resolvedIds.has(item.thread.root.id)}
                    />
                  ) : (
                    <CommitTimelineGroup
                      key={`commits-${item.commits[0].sha}`}
                      repo={pr.repo}
                      commits={item.commits}
                    />
                  ),
                )}
                <Box mt={timeline.length > 0 ? "3" : "0"}>
                  <SectionHeading>Add a comment</SectionHeading>
                  <CommentComposer pr={pr} />
                </Box>
              </VStack>
            </Box>
          </>
        )}

        <Separator />

        <OpenedUpdatedLine
          createdAt={detail.createdAt}
          updatedAt={detail.updatedAt}
        />
      </VStack>
    </Box>
  );
}
