import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  IconButton,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LuArrowLeft,
  LuExternalLink,
  LuFileDiff,
  LuInfo,
  LuRefreshCw,
  LuSparkles,
} from "react-icons/lu";
import type {
  PullRequest,
  PullRequestActivity,
  PullRequestDetail,
} from "../../../shared/types";
import ChangesView from "../components/ChangesView";
import CopyPrLinkButton from "../components/CopyPrLinkButton";
import DiffViewModeSelect from "../components/DiffViewModeSelect";
import FavouritePrButton from "../components/FavouritePrButton";
import PullRequestActionsMenu from "../components/PullRequestActionsMenu";
import PullRequestOverview from "../components/PullRequestOverview";
import ReanalyzeButton from "../components/ReanalyzeButton";
import ReviewPanel from "../components/ReviewPanel";
import ShowSidebarButton from "../components/ShowSidebarButton";
import { useSidebarCollapsed } from "../lib/sidebarCollapsed";
import { dragRegion, titleBarHeight, trafficLightSpace } from "../lib/titleBar";

// The review screen's three tabs. Exported because the callers that open a PR
// choose which one it lands on — "Review changes" goes straight to the diff.
export type ReviewTab = "overview" | "changes" | "review";

interface Props {
  pr: PullRequest;
  // Which tab this PR opens on. Defaults to the overview: most ways in are
  // "show me this PR", and the overview is what that means.
  initialTab?: ReviewTab;
  onBack(): void;
}

// What's newer on GitHub than the data on screen — the polled snapshot vs the
// detail the screen rendered from. Null means nothing to highlight.
function describeActivity(
  detail: PullRequestDetail | undefined,
  activity: PullRequestActivity | null | undefined,
): string | null {
  if (!detail || !activity) return null;
  const parts: string[] = [];
  if (activity.headSha !== detail.headSha) {
    const commits = activity.commits - detail.commits;
    parts.push(
      commits > 0
        ? `${commits} new commit${commits === 1 ? "" : "s"}`
        : "new commits",
    );
  }
  const comments = activity.comments - detail.comments;
  if (comments > 0) {
    parts.push(`${comments} new comment${comments === 1 ? "" : "s"}`);
  }
  // Anything else that bumped the PR — reviews, labels, edits, deletions.
  if (
    parts.length === 0 &&
    new Date(activity.updatedAt) > new Date(detail.updatedAt)
  ) {
    parts.push("updated on GitHub");
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

export default function Review({ pr, initialTab, onBack }: Props) {
  const tabKey = `${pr.repo}#${pr.number}#${initialTab ?? "overview"}`;
  const [tabState, setTabState] = useState({
    key: tabKey,
    value: initialTab ?? "overview",
  });
  const activeTab =
    tabState.key === tabKey ? tabState.value : (initialTab ?? "overview");
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  // With the sidebar hidden its header is gone too, so this bar takes over
  // holding the window's traffic lights clear.
  const collapsed = useSidebarCollapsed();

  // Same key as the Overview tab's query, so the two share one fetch.
  const detailQuery = useQuery({
    queryKey: ["pullRequest", pr.repo, pr.number],
    queryFn: () => window.api.getPullRequest(pr.repo, pr.number),
  });
  const detail = detailQuery.data;

  // A cheap background poll (ETag conditional request, free while unchanged)
  // that never touches the screen's data — it only decides whether the
  // refresh button lights up. The refresh below invalidates this key too
  // (same repo + number slots), so the highlight clears itself on refresh.
  const activityQuery = useQuery({
    queryKey: ["prActivity", pr.repo, pr.number],
    queryFn: () => window.api.peekPullRequestActivity(pr.repo, pr.number),
    refetchInterval: 60_000,
    enabled: Boolean(detail),
  });
  const newActivity = describeActivity(detail, activityQuery.data);

  function selectTab(tab: ReviewTab) {
    setTabState({ key: tabKey, value: tab });
  }

  // Refetch everything this PR shows — detail, diffs, comments, reviews. Match
  // by predicate so any query scoped to this repo + PR number is busted.
  async function refresh() {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[1] === pr.repo && query.queryKey[2] === pr.number,
      });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Flex direction="column" flex="1" minW="0" minH="0">
      {/* One row, the same height as the home screen's bar, so the window's
          traffic lights sit centred in both. */}
      <HStack
        gap="2"
        pl={collapsed ? trafficLightSpace : "4"}
        pr="4"
        h={titleBarHeight}
        borderBottomWidth="1px"
        flexShrink="0"
        align="center"
        css={dragRegion}
      >
        <ShowSidebarButton />
        <Button variant="outline" size="xs" onClick={onBack}>
          <LuArrowLeft /> Back
        </Button>
        <HStack gap="2" flex="1" minW="0" alignItems="baseline">
          <Heading size="sm" truncate>
            {pr.title}
          </Heading>
          <Text fontFamily="mono" fontSize="xs" color="fg.muted" flexShrink="0">
            {pr.repo}#{pr.number}
          </Text>
        </HStack>

        {newActivity ? (
          <Button
            title={`Refresh — ${newActivity}`}
            colorPalette="yellow"
            variant="outline"
            size="xs"
            onClick={refresh}
            loading={refreshing}
            loadingText="Refreshing…"
          >
            <LuRefreshCw /> Refresh to update
          </Button>
        ) : (
          <IconButton
            aria-label="Refresh"
            title="Refresh"
            variant="outline"
            size="xs"
            onClick={refresh}
            loading={refreshing}
          >
            <LuRefreshCw />
          </IconButton>
        )}
        <FavouritePrButton pr={pr} />
        <Button asChild variant="outline" size="xs">
          <a href={pr.url} target="_blank" rel="noreferrer">
            <LuExternalLink /> Open in GitHub
          </a>
        </Button>
        <CopyPrLinkButton url={pr.url} />
        <ReanalyzeButton pr={pr} />
        {detail && <PullRequestActionsMenu pr={pr} detail={detail} />}
      </HStack>

      {/* Keyed by PR *and* entry tab, since `defaultValue` only applies on
          mount: without the PR the tabs would keep whichever one the last PR
          was left on ("Review changes" landing on the overview), and without
          the tab a caller reopening the same PR on a different one would be
          silently ignored. */}
      <Tabs.Root
        key={`${pr.repo}#${pr.number}#${initialTab ?? "overview"}`}
        defaultValue={initialTab ?? "overview"}
        onValueChange={(event) => selectTab(event.value as ReviewTab)}
        display="flex"
        flexDirection="column"
        flex="1"
        minH="0"
      >
        <Tabs.List flexShrink="0" px="4" alignItems="center">
          <Tabs.Trigger value="overview">
            <LuInfo /> Overview
          </Tabs.Trigger>
          <Tabs.Trigger value="changes">
            <LuFileDiff /> Changes ({pr.changedFiles})
          </Tabs.Trigger>
          <Tabs.Trigger value="review">
            <LuSparkles /> Review
          </Tabs.Trigger>
          {activeTab !== "changes" && (
            <Box ml="auto">
              <DiffViewModeSelect />
            </Box>
          )}
        </Tabs.List>

        <Tabs.Content value="overview" flex="1" minH="0" p="0">
          <PullRequestOverview pr={pr} showActions />
        </Tabs.Content>
        <Tabs.Content value="changes" flex="1" minH="0" p="0">
          <ChangesView pr={pr} />
        </Tabs.Content>
        <Tabs.Content value="review" flex="1" minH="0" p="0">
          <ReviewPanel pr={pr} />
        </Tabs.Content>
      </Tabs.Root>
    </Flex>
  );
}
