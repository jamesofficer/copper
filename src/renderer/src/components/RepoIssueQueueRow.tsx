import { Box, Text } from "@chakra-ui/react";
import { LuCircleDot } from "react-icons/lu";
import type { RepoIssue } from "../../../shared/types";
import CommentCountBadge from "./CommentCountBadge";
import LabelBadges from "./LabelBadges";
import QueueRow from "./QueueRow";
import RelativeTime from "./RelativeTime";

interface Props {
  issue: RepoIssue;
  // The timestamp to show, picked by the list to match its sort.
  time: string;
  selected?: boolean;
  onSelect(issue: RepoIssue): void;
}

export default function RepoIssueQueueRow({
  issue,
  time,
  selected,
  onSelect,
}: Props) {
  return (
    <QueueRow
      selected={selected}
      onClick={() => onSelect(issue)}
      title={issue.title}
      icon={
        <Box
          display="flex"
          fontSize="15px"
          color="green.fg"
          title="Open issue"
          aria-label="Open issue"
        >
          <LuCircleDot />
        </Box>
      }
      meta={
        <>
          <Text flexShrink="0">#{issue.number}</Text>
          <Text truncate>{issue.author}</Text>
          <Box ml="auto" flexShrink="0">
            <CommentCountBadge count={issue.comments} />
          </Box>
        </>
      }
      // Labels take the slot the pull-request rows give the repo slug: they're
      // the one thing that tells two same-shaped issues apart at a glance.
      footerLeft={<LabelBadges labels={issue.labels} size="sm" />}
      footerRight={<RelativeTime iso={time} />}
    />
  );
}
