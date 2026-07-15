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
import {
  LuGitCommitHorizontal,
  LuGitMerge,
  LuGitPullRequest,
  LuGitPullRequestClosed,
  LuGitPullRequestDraft,
} from "react-icons/lu";
import type { PullRequest, PullRequestDetail } from "../../../shared/types";
import { scrollbar } from "../lib/scrollbar";
import Markdown from "./Markdown";
import ReviewStatusBadge from "./ReviewStatusBadge";

interface Props {
  pr: PullRequest;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function stateMeta(detail: PullRequestDetail) {
  if (detail.merged) {
    return { label: "Merged", palette: "purple", icon: <LuGitMerge /> };
  }
  if (detail.state === "closed") {
    return {
      label: "Closed",
      palette: "red",
      icon: <LuGitPullRequestClosed />,
    };
  }
  if (detail.draft) {
    return { label: "Draft", palette: "gray", icon: <LuGitPullRequestDraft /> };
  }
  return { label: "Open", palette: "green", icon: <LuGitPullRequest /> };
}

export default function PullRequestOverview({ pr }: Props) {
  const detailQuery = useQuery({
    queryKey: ["pullRequest", pr.repo, pr.number],
    queryFn: () => window.api.getPullRequest(pr.repo, pr.number),
  });

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
  const state = stateMeta(detail);
  // "Awaiting review" is only meaningful while the PR is still open; a
  // definitive verdict stays interesting even after merge/close.
  const showReviewStatus =
    (detail.state === "open" && !detail.merged) ||
    detail.reviewStatus !== "awaiting_review";

  return (
    <Box h="full" overflowY="auto" css={scrollbar}>
      <VStack gap="6" alignItems="stretch" maxW="3xl" mx="auto" px="8" py="8">
        <VStack gap="3" alignItems="stretch">
          <HStack gap="3" alignItems="flex-start">
            <HStack gap="1.5" flexShrink="0">
              <Badge colorPalette={state.palette} variant="surface" size="lg">
                {state.icon}
                {state.label}
              </Badge>
              {showReviewStatus && (
                <ReviewStatusBadge status={detail.reviewStatus} size="lg" />
              )}
            </HStack>
            <Heading size="lg" lineHeight="1.3">
              {detail.title}
            </Heading>
          </HStack>

          <HStack
            fontFamily="mono"
            fontSize="sm"
            color="fg.muted"
            gap="2"
            flexWrap="wrap"
          >
            <Text>#{detail.number}</Text>
            <Text>·</Text>
            <Text color="fg">{detail.author}</Text>
            <Text>wants to merge into</Text>
            <Badge variant="outline">{detail.baseRef}</Badge>
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
                style={{
                  borderColor: `#${label.color}`,
                  color: `#${label.color}`,
                }}
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

        {detail.reviewers.length > 0 && (
          <HStack fontSize="sm" gap="2" flexWrap="wrap">
            <Text color="fg.muted">Reviewers</Text>
            {detail.reviewers.map((reviewer) => (
              <Badge key={reviewer} variant="subtle" fontFamily="mono">
                {reviewer}
              </Badge>
            ))}
          </HStack>
        )}

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

        <Separator />

        <HStack fontSize="xs" color="fg.subtle" gap="4" flexWrap="wrap">
          <Text>Opened {formatDate(detail.createdAt)}</Text>
          <Text>Updated {formatDate(detail.updatedAt)}</Text>
        </HStack>
      </VStack>
    </Box>
  );
}
