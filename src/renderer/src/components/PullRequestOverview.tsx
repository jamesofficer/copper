import {
  Box,
  Separator,
  type SystemStyleObject,
  VStack,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import type {
  PullRequest,
  PullRequestComment,
  PullRequestCommit,
  PullRequestReview,
  ReviewComment,
} from "../../../shared/types";
import { listReviewThreads, type ReviewThread } from "../lib/reviewComments";
import { scrollbar } from "../lib/scrollbar";
import CommentCard from "./CommentCard";
import CommentComposer from "./CommentComposer";
import CommitTimelineGroup from "./CommitTimelineGroup";
import { PanelError, PanelLoading, PanelSectionError } from "./PanelState";
import PullRequestDescription from "./PullRequestDescription";
import PullRequestHero from "./PullRequestHero";
import PullRequestSidebar from "./PullRequestSidebar";
import ReviewCard from "./ReviewCard";
import ReviewThreadCard from "./ReviewThreadCard";
import SectionHeading from "./SectionHeading";

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

// The panel is a column beside the queue on the home screen and the whole
// window on the review screen, so the rail can't key off viewport breakpoints —
// a container query asks the only question that matters: is there room here for
// two columns?
const RAIL_BREAKPOINT = "@container (max-width: 900px)";

const panelCss: SystemStyleObject = { containerType: "inline-size" };

const layoutCss: SystemStyleObject = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 260px",
  gap: "8",
  [RAIL_BREAKPOINT]: { gridTemplateColumns: "minmax(0, 1fr)" },
};

// Sticky, so the PR's standing facts stay put while the conversation scrolls —
// but only while it is a column; stacked underneath there is nothing to stick
// to.
const railCss: SystemStyleObject = {
  borderLeftWidth: "1px",
  pl: "6",
  position: "sticky",
  top: "0",
  alignSelf: "start",
  [RAIL_BREAKPOINT]: {
    borderLeftWidth: "0",
    borderTopWidth: "1px",
    pl: "0",
    pt: "6",
    position: "static",
  },
};

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
  // A failed comment fetch used to hide the whole conversation — reviews,
  // commits and the comment box included. The rest of the timeline doesn't
  // depend on comments, so it still builds without them and the gap is
  // reported where it is.
  const timeline = commentsQuery.isPending
    ? []
    : buildTimeline(comments ?? [], reviews, reviewComments, commits);
  const rendered = groupTimeline(timeline);
  // The header count reflects discussion, not commits.
  const discussionCount = timeline.filter(
    (item) => item.kind !== "commit",
  ).length;

  return (
    <Box h="full" overflowY="auto" css={scrollbar}>
      <Box maxW="6xl" mx="auto" px="8" py="8" css={panelCss}>
        <PullRequestHero detail={detail} />

        <Separator my="6" />

        <Box css={layoutCss}>
          <VStack gap="6" alignItems="stretch" minW="0">
            <PullRequestDescription detail={detail} editable={showActions} />

            {!commentsQuery.isPending && (
              <>
                <Separator />
                <Box>
                  <SectionHeading>
                    Conversation ({discussionCount})
                  </SectionHeading>
                  <VStack gap="3" alignItems="stretch">
                    {commentsQuery.isError && (
                      <PanelSectionError
                        message="Couldn’t load the comments on this pull request."
                        retrying={commentsQuery.isFetching}
                        onRetry={() => void commentsQuery.refetch()}
                      />
                    )}
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
          </VStack>

          <Box css={railCss}>
            <PullRequestSidebar
              detail={detail}
              reviews={reviews}
              showProgress={showActions}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
