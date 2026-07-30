import { Box, HStack, Skeleton, Spinner, Text } from "@chakra-ui/react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { LuGitPullRequest } from "react-icons/lu";
import type { PullRequest } from "../../../shared/types";
import { timeAgo } from "../lib/recentPrs";
import ClearAnalysisButton from "./ClearAnalysisButton";
import SidebarPullRequestRow from "./SidebarPullRequestRow";
import UserAvatar from "./UserAvatar";

// The sidebar's Analysed section shows the newest few, not the whole cache —
// it sits alongside four other sections and this list only grows.
const MAX_SHOWN = 7;

interface Props {
  // The PR the review screen is showing, marked in the list.
  openPr: PullRequest | null;
  onSelect(pr: PullRequest): void;
}

// PRs the user has run the analysis on, newest first, across every repo. The
// main process's cache only stores repo/number/sha, so each row fetches live PR
// detail to get its title and author.
export default function AnalyzedSidebarList({ openPr, onSelect }: Props) {
  const analyzedQuery = useQuery({
    queryKey: ["analyzedPullRequests"],
    queryFn: () => window.api.listAnalyzedPullRequests(),
  });
  const analyzed = useMemo(
    () => (analyzedQuery.data ?? []).slice(0, MAX_SHOWN),
    [analyzedQuery.data],
  );

  // Same query key as the Overview, so the detail is shared; peekPullRequest
  // skips the repo warm-up getPullRequest triggers.
  const detailQueries = useQueries({
    queries: analyzed.map((entry) => ({
      queryKey: ["pullRequest", entry.repo, entry.prNumber],
      queryFn: () => window.api.peekPullRequest(entry.repo, entry.prNumber),
    })),
  });

  if (analyzedQuery.isPending) {
    return <Spinner size="sm" color="fg.muted" alignSelf="center" my="2" />;
  }

  if (analyzed.length === 0) {
    return (
      <Text fontSize="xs" color="fg.muted" px="2">
        Pull requests you analyse will show up here.
      </Text>
    );
  }

  return (
    <>
      {analyzed.map((entry, index) => {
        const key = `${entry.repo}#${entry.prNumber}`;
        const detail = detailQueries[index]?.data;
        if (!detail) {
          return detailQueries[index]?.isError ? (
            // Still offer the clear button — an entry whose PR no longer loads
            // is exactly the kind worth clearing.
            <HStack key={key} px="2" gap="1">
              <Text fontSize="xs" color="fg.muted" flex="1" truncate>
                {key} couldn’t be loaded.
              </Text>
              <ClearAnalysisButton
                repo={entry.repo}
                prNumber={entry.prNumber}
              />
            </HStack>
          ) : (
            <Skeleton key={key} h="7" rounded="md" mx="2" />
          );
        }
        // The analysis was run against a commit that's no longer the head, so
        // what it says may no longer match the diff.
        const outdated = detail.headSha !== entry.headSha;
        return (
          <SidebarPullRequestRow
            key={key}
            pr={detail}
            selected={
              openPr?.repo === entry.repo && openPr?.number === entry.prNumber
            }
            onSelect={onSelect}
            leading={
              <UserAvatar
                username={detail.author}
                fallback={<LuGitPullRequest />}
              />
            }
            meta={
              <Box
                color={outdated ? "orange.fg" : "fg.muted"}
                title={
                  outdated
                    ? "Analysed an earlier commit — re-analyse for the latest"
                    : undefined
                }
              >
                {timeAgo(entry.analyzedAt)}
              </Box>
            }
            actions={
              <ClearAnalysisButton
                repo={entry.repo}
                prNumber={entry.prNumber}
              />
            }
          />
        );
      })}
    </>
  );
}
