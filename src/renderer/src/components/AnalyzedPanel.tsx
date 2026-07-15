import { HStack, Skeleton, Spinner, Stack, Text } from "@chakra-ui/react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { PullRequest } from "../../../shared/types";
import { scrollbar } from "../lib/scrollbar";
import PullRequestCard from "./PullRequestCard";

interface Props {
  onSelect(pr: PullRequest): void;
}

// The "Analysed pull requests" tab on the welcome screen: every PR the user
// has run the analyse feature on, newest analysis first. The list comes from
// the main process's analysis cache, which only stores repo/number/sha — so
// each entry fetches live PR detail to render its card.
export default function AnalyzedPanel({ onSelect }: Props) {
  const analyzedQuery = useQuery({
    queryKey: ["analyzedPullRequests"],
    queryFn: () => window.api.listAnalyzedPullRequests(),
  });
  const analyzed = analyzedQuery.data ?? [];

  // Same query key as the Overview and recently-viewed tabs, so the detail is
  // shared; peekPullRequest skips the repo warm-up getPullRequest triggers.
  const detailQueries = useQueries({
    queries: analyzed.map((entry) => ({
      queryKey: ["pullRequest", entry.repo, entry.prNumber],
      queryFn: () => window.api.peekPullRequest(entry.repo, entry.prNumber),
    })),
  });

  if (analyzedQuery.isPending) {
    return (
      <HStack color="fg.muted" px="4" py="4">
        <Spinner size="sm" />
        <Text fontSize="sm">Loading analysed pull requests…</Text>
      </HStack>
    );
  }

  if (analyzed.length === 0) {
    return (
      <Text fontSize="sm" color="fg.muted" px="4" py="4">
        Pull requests you analyse will show up here.
      </Text>
    );
  }

  return (
    <Stack
      h="full"
      minH="0"
      overflowY="auto"
      gap="3"
      px="4"
      py="4"
      css={scrollbar}
    >
      {analyzed.map((entry, index) => {
        const key = `${entry.repo}#${entry.prNumber}`;
        const query = detailQueries[index];
        if (!query?.data) {
          return query?.isError ? (
            <Text key={key} fontSize="sm" color="fg.muted">
              {key} couldn’t be loaded.
            </Text>
          ) : (
            <Skeleton key={key} h="24" rounded="lg" maxW="2xl" />
          );
        }
        return (
          <PullRequestCard
            key={key}
            pr={query.data}
            detail={query.data}
            onSelect={onSelect}
            showRepo
            viewedAt={entry.analyzedAt}
            maxW="2xl"
            analysisOutdated={query.data.headSha !== entry.headSha}
          />
        );
      })}
    </Stack>
  );
}
