import { Box, Separator, Text, VStack } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import type { RepoIssue } from "../../../shared/types";
import CommentCard from "./CommentCard";
import Markdown from "./Markdown";
import { PanelError, PanelLoading, PanelSectionError } from "./PanelState";
import ReadingPanel from "./ReadingPanel";
import RepoIssueHero from "./RepoIssueHero";
import RepoIssueSidebar from "./RepoIssueSidebar";
import SectionHeading from "./SectionHeading";

interface Props {
  issue: RepoIssue;
}

// The issue reading panel. Two queries where PullRequestOverview needs six —
// an issue has no reviews, no inline threads and no commits, so its
// conversation is a plain oldest-first comment list — but the same layout, via
// ReadingPanel: hero, reading column, rail.
export default function RepoIssueOverview({ issue }: Props) {
  const detailQuery = useQuery({
    queryKey: ["repoIssue", issue.repo, issue.number],
    queryFn: () => window.api.getRepoIssue(issue.repo, issue.number),
  });

  const commentsQuery = useQuery({
    queryKey: ["repoIssueComments", issue.repo, issue.number],
    queryFn: () => window.api.listRepoIssueComments(issue.repo, issue.number),
  });
  const comments = commentsQuery.data;

  if (detailQuery.isPending) {
    return <PanelLoading label="Loading issue…" />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <PanelError
        message={
          detailQuery.error instanceof Error
            ? detailQuery.error.message
            : "Couldn't load this issue."
        }
      />
    );
  }

  const detail = detailQuery.data;

  return (
    <ReadingPanel
      hero={<RepoIssueHero detail={detail} comments={comments?.length} />}
      rail={<RepoIssueSidebar detail={detail} />}
    >
      <VStack gap="6" alignItems="stretch">
        <Box>
          <SectionHeading>Description</SectionHeading>
          {detail.body?.trim() ? (
            <Markdown>{detail.body}</Markdown>
          ) : (
            <Text fontSize="sm" color="fg.muted" fontStyle="italic">
              No description provided.
            </Text>
          )}
        </Box>

        {commentsQuery.isError && (
          <>
            <Separator />
            <PanelSectionError
              message="Couldn’t load the comments on this issue."
              retrying={commentsQuery.isFetching}
              onRetry={() => void commentsQuery.refetch()}
            />
          </>
        )}

        {comments && comments.length > 0 && (
          <>
            <Separator />
            <Box>
              <SectionHeading>Conversation ({comments.length})</SectionHeading>
              <VStack gap="3" alignItems="stretch">
                {comments.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    repo={issue.repo}
                    number={issue.number}
                    showReactions={false}
                  />
                ))}
              </VStack>
            </Box>
          </>
        )}
      </VStack>
    </ReadingPanel>
  );
}
