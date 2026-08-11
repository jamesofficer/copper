import { Box, HStack, Text } from "@chakra-ui/react";
import { LuGitPullRequest, LuGitPullRequestDraft } from "react-icons/lu";
import type { PullRequest, ReviewStatus } from "../../../shared/types";
import CommentCountBadge from "./CommentCountBadge";
import QueueRow from "./QueueRow";
import RelativeTime from "./RelativeTime";
import { reviewStatusMeta } from "./ReviewStatusBadge";

// The rows carry no state badges, so the icon carries the review verdict
// instead. Awaiting review is deliberately neutral rather than the badge's
// orange: it's the resting state of most open PRs, and colouring it would
// leave a column of warnings with nothing to warn about.
const statusColor: Record<ReviewStatus, string> = {
  approved: "green.fg",
  changes_requested: "red.fg",
  awaiting_review: "fg.muted",
};

interface Props {
  pr: PullRequest;
  // The timestamp to show, picked by the list to match its sort.
  time: string;
  selected?: boolean;
  onSelect(pr: PullRequest): void;
  // Double-click skips the preview panel and opens the PR outright.
  onOpen?(pr: PullRequest): void;
}

export default function PullRequestQueueRow({
  pr,
  time,
  selected,
  onSelect,
  onOpen,
}: Props) {
  const status = pr.reviewStatus
    ? reviewStatusMeta[pr.reviewStatus]
    : undefined;
  const label = pr.draft ? "Draft" : (status?.label ?? "Pull request");

  return (
    <QueueRow
      selected={selected}
      onClick={() => onSelect(pr)}
      onDoubleClick={onOpen ? () => onOpen(pr) : undefined}
      title={pr.title}
      icon={
        <Box
          color={
            pr.draft
              ? "fg.subtle"
              : (statusColor[pr.reviewStatus] ?? "fg.muted")
          }
          title={label}
          aria-label={label}
        >
          {pr.draft ? (
            <LuGitPullRequestDraft size={15} />
          ) : (
            <LuGitPullRequest size={15} />
          )}
        </Box>
      }
      trailing={
        <HStack gap="1.5" fontFamily="mono" fontSize="xs">
          <Text color="green.fg">+{pr.additions}</Text>
          <Text color="red.fg">−{pr.deletions}</Text>
        </HStack>
      }
      meta={
        <>
          <Text flexShrink="0">#{pr.number}</Text>
          <Text truncate>
            {pr.author}
            {pr.commits === undefined
              ? ""
              : ` · ${pr.commits} ${pr.commits === 1 ? "commit" : "commits"}`}
            {` · ${pr.changedFiles} ${pr.changedFiles === 1 ? "file" : "files"}`}
          </Text>
          <Box ml="auto" flexShrink="0">
            <CommentCountBadge count={pr.comments} />
          </Box>
        </>
      }
      footerLeft={pr.repo}
      footerRight={<RelativeTime iso={time} />}
    />
  );
}
