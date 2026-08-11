import { Badge, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import { LuCircleCheck, LuCircleDot, LuCircleSlash } from "react-icons/lu";
import type { RepoIssueDetail } from "../../../shared/types";
import UserAvatar from "./UserAvatar";

// One badge with a handful of outcomes, so it lives here rather than in its own
// file. The list only carries open issues, so it rarely says anything else —
// but a preview left open while the issue closes elsewhere should tell the
// truth. Only "completed" claims the issue was done: GitHub recorded no reason
// at all before 2022, and a plain "Closed" is the honest reading of that.
function IssueStateBadge({ detail }: { detail: RepoIssueDetail }) {
  if (detail.state === "open") {
    return (
      <Badge colorPalette="green" variant="surface" size="lg">
        <LuCircleDot size={12} /> Open
      </Badge>
    );
  }
  if (detail.stateReason === "completed") {
    return (
      <Badge colorPalette="purple" variant="surface" size="lg">
        <LuCircleCheck size={12} /> Closed as completed
      </Badge>
    );
  }
  return (
    <Badge colorPalette="gray" variant="surface" size="lg">
      <LuCircleSlash size={12} />
      {detail.stateReason === "not_planned"
        ? "Closed as not planned"
        : detail.stateReason === "duplicate"
          ? "Closed as duplicate"
          : "Closed"}
    </Badge>
  );
}

interface Props {
  detail: RepoIssueDetail;
  comments: number | undefined;
}

// The issue equivalent of PullRequestHero, deliberately the same shape: title,
// state, then one mono line of numbers. An issue has no branches and no diff,
// so it ends there — the line carries the comment count instead of a PR's
// commits/files/lines, and only once the comments have loaded, since a count
// that starts at zero and jumps reads as an issue nobody replied to.
export default function RepoIssueHero({ detail, comments }: Props) {
  return (
    <VStack gap="4" alignItems="stretch">
      <Heading size="3xl" fontWeight="normal" lineHeight="1.25">
        {detail.title}
      </Heading>

      <HStack gap="1.5" flexWrap="wrap">
        <IssueStateBadge detail={detail} />
      </HStack>

      <HStack
        fontFamily="mono"
        fontSize="sm"
        color="fg.muted"
        gap="2"
        flexWrap="wrap"
      >
        <Text>#{detail.number}</Text>
        <Text color="fg.subtle">·</Text>
        <HStack gap="1.5">
          <UserAvatar username={detail.author} />
          <Text color="fg">{detail.author}</Text>
        </HStack>
        {comments !== undefined && (
          <>
            <Text color="fg.subtle">·</Text>
            <Text>
              {comments} comment{comments === 1 ? "" : "s"}
            </Text>
          </>
        )}
      </HStack>
    </VStack>
  );
}
