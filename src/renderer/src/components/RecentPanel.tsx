import { Stack, Text } from "@chakra-ui/react";
import { useQueries } from "@tanstack/react-query";
import type { PullRequest } from "../../../shared/types";
import type { RecentPullRequest } from "../lib/recentPrs";
import { scrollbar } from "../lib/scrollbar";
import PullRequestCard from "./PullRequestCard";

interface Props {
  recent: RecentPullRequest[];
  onSelect(pr: PullRequest): void;
}

// The "Recently viewed" tab on the welcome screen: PRs the user has opened,
// newest first, from any repo. The list itself lives in Welcome so the tab
// bar's Clear button can reset it.
export default function RecentPanel({ recent, onSelect }: Props) {
  // The stored snapshots go stale (a PR gets merged or approved after it was
  // viewed), so fetch live detail for each and let it win over the snapshot.
  // Same query key as the Overview tab, so the two share a cache entry;
  // peekPullRequest skips the repo warm-up getPullRequest would trigger.
  const detailQueries = useQueries({
    queries: recent.map((pr) => ({
      queryKey: ["pullRequest", pr.repo, pr.number],
      queryFn: () => window.api.peekPullRequest(pr.repo, pr.number),
    })),
  });

  if (recent.length === 0) {
    return (
      <Text fontSize="sm" color="fg.muted" px="4" py="4">
        Pull requests you open will show up here.
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
      {recent.map((pr, index) => (
        <PullRequestCard
          key={`${pr.repo}#${pr.number}`}
          pr={pr}
          detail={detailQueries[index]?.data}
          onSelect={onSelect}
          showRepo
          viewedAt={pr.viewedAt}
          maxW="2xl"
        />
      ))}
    </Stack>
  );
}
