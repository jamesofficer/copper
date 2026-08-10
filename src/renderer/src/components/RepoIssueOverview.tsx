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
import { LuCircleCheck, LuCircleDot, LuCircleSlash } from "react-icons/lu";
import type { RepoIssue, RepoIssueDetail } from "../../../shared/types";
import { scrollbar } from "../lib/scrollbar";
import CommentCard from "./CommentCard";
import LabelBadges from "./LabelBadges";
import Markdown from "./Markdown";
import OpenedUpdatedLine from "./OpenedUpdatedLine";
import { PanelError, PanelLoading } from "./PanelState";
import SectionHeading from "./SectionHeading";
import UserAvatar from "./UserAvatar";

interface Props {
  issue: RepoIssue;
}

// One badge with three outcomes, so it lives here rather than in its own file.
// The list only carries open issues, so it rarely says anything else — but a
// preview left open while the issue closes elsewhere should tell the truth.
function IssueStateBadge({ detail }: { detail: RepoIssueDetail }) {
  if (detail.state === "open") {
    return (
      <Badge colorPalette="green" variant="surface" size="lg">
        <LuCircleDot size={12} /> Open
      </Badge>
    );
  }
  if (detail.stateReason === "not_planned") {
    return (
      <Badge colorPalette="gray" variant="surface" size="lg">
        <LuCircleSlash size={12} /> Closed as not planned
      </Badge>
    );
  }
  return (
    <Badge colorPalette="purple" variant="surface" size="lg">
      <LuCircleCheck size={12} /> Closed as completed
    </Badge>
  );
}

// The issue reading panel. Two queries where PullRequestOverview needs six —
// an issue has no reviews, no inline threads and no commits, so its
// conversation is a plain oldest-first comment list.
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
    <Box h="full" overflowY="auto" css={scrollbar}>
      <VStack gap="6" alignItems="stretch" maxW="3xl" mx="auto" px="8" py="8">
        <VStack gap="3" alignItems="stretch">
          <HStack gap="1.5">
            <IssueStateBadge detail={detail} />
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
            <Text>opened this issue</Text>
          </HStack>
        </VStack>

        <LabelBadges labels={detail.labels} />

        {detail.assignees.length > 0 && (
          <Box>
            <SectionHeading>Assignees</SectionHeading>
            <HStack gap="4" flexWrap="wrap">
              {detail.assignees.map((assignee) => (
                <HStack key={assignee} gap="1.5" fontSize="sm">
                  <UserAvatar username={assignee} />
                  <Text>{assignee}</Text>
                </HStack>
              ))}
            </HStack>
          </Box>
        )}

        <Separator />

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

        <Separator />

        <OpenedUpdatedLine
          createdAt={detail.createdAt}
          updatedAt={detail.updatedAt}
        />
      </VStack>
    </Box>
  );
}
