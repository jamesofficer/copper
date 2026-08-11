import { Box, HStack, Text } from "@chakra-ui/react";
import type { PullRequest } from "../../../shared/types";
import CommentCountBadge from "./CommentCountBadge";
import { prStateMeta } from "./PrStateBadge";
import QueueRow from "./QueueRow";
import RelativeTime from "./RelativeTime";

// The rows carry no state badge, so the icon carries the state: grey draft,
// green open, purple merged, red closed. Green rather than PrStateBadge's blue
// for open — GitHub's colour, and a whole column of blue icons reads as links.
const stateColor: Record<ReturnType<typeof prStateMeta>["kind"], string> = {
  draft: "fg.subtle",
  open: "green.fg",
  merged: "purple.fg",
  closed: "red.fg",
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
  // The summary carries no state or merged flag because every list feeding these
  // rows asks GitHub for open PRs only — so the icon is a draft or it's open.
  const state = prStateMeta({ state: "open", draft: pr.draft, merged: false });

  return (
    <QueueRow
      selected={selected}
      onClick={() => onSelect(pr)}
      onDoubleClick={onOpen ? () => onOpen(pr) : undefined}
      title={pr.title}
      icon={
        <Box
          color={stateColor[state.kind]}
          title={state.label}
          aria-label={state.label}
          css={{ "& svg": { width: "15px", height: "15px" } }}
        >
          {state.icon}
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
