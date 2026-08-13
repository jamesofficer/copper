import { Badge, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import { LuArrowRight } from "react-icons/lu";
import type { PullRequestDetail } from "../../../shared/types";
import { useCopyToClipboard } from "../lib/useCopyToClipboard";
import BaseBranchSelect from "./BaseBranchSelect";
import PrStateBadge from "./PrStateBadge";
import ReviewStatusBadge, { shouldShowReviewStatus } from "./ReviewStatusBadge";
import UserAvatar from "./UserAvatar";

interface Props {
  detail: PullRequestDetail;
}

// The top of the overview: what this PR is, then what state it's in, then its
// numbers, then where it's going. Title first because the title is what a
// reviewer is looking for when the panel paints — the badges above it made the
// eye start on a chip instead.
export default function PullRequestHero({ detail }: Props) {
  const headBranch = useCopyToClipboard({
    errorTitle: "Couldn’t copy branch name",
    successTitle: "Branch name copied",
  });

  return (
    <VStack gap="4" alignItems="stretch">
      {/* Bigger than a section heading and lighter than one: at this size the
          title doesn't need weight to be found first, and Google Sans Flex is a
          variable font, so 400 here costs no extra file. */}
      <Heading size="3xl" fontWeight="normal" lineHeight="1.25">
        {detail.title}
      </Heading>

      <HStack gap="1.5" flexWrap="wrap">
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

      {/* One line for every number on the PR — id, author, size. Splitting
          these across two rows made the panel's first screen mostly metadata. */}
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
        <Text color="fg.subtle">·</Text>
        <Text>
          {detail.commits} commit{detail.commits === 1 ? "" : "s"}
        </Text>
        <Text color="fg.subtle">·</Text>
        <Text>
          {detail.changedFiles} file{detail.changedFiles === 1 ? "" : "s"}
        </Text>
        <Text color="fg.subtle">·</Text>
        <HStack gap="2">
          <Text color="green.fg">+{detail.additions}</Text>
          <Text color="red.fg">−{detail.deletions}</Text>
        </HStack>
      </HStack>

      {/* Head → base, in the direction the code travels. The base is the
          editable one, so it keeps its select. */}
      <HStack
        gap="3"
        flexWrap="wrap"
        aria-label={`Merges ${detail.headRef} into ${detail.baseRef}`}
      >
        <Badge
          as="button"
          variant="outline"
          size="lg"
          fontFamily="mono"
          cursor="pointer"
          title="Copy branch name"
          transition="background 0.15s"
          _hover={{ bg: "bg.emphasized" }}
          onClick={() => void headBranch.copy(detail.headRef)}
        >
          {detail.headRef}
        </Badge>
        <Text color="fg.subtle" aria-hidden="true">
          <LuArrowRight />
        </Text>
        <BaseBranchSelect detail={detail} />
      </HStack>
    </VStack>
  );
}
