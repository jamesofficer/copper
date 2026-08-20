import { HStack, IconButton, Text } from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LuRefreshCw } from "react-icons/lu";
import type { PullRequest, Repository } from "../../../shared/types";
import { pullRequestsQueryOptions } from "../lib/repoQueries";
import { useSidebarCollapsed } from "../lib/sidebarCollapsed";
import { dragRegion, titleBarHeight, trafficLightSpace } from "../lib/titleBar";
import {
  localChangeCountQueryOptions,
  localChangesQueryOptions,
} from "../lib/useLocalChanges";
import type { WorktreeSelection } from "../lib/useWorktreeSelection";
import NewPullRequestDialog from "./NewPullRequestDialog";
import QueueActionsMenu from "./QueueActionsMenu";
import ShowSidebarButton from "./ShowSidebarButton";

export type QueueView = "pull-requests" | "local-changes";

interface Props {
  repo: Repository | null;
  tab: QueueView;
  worktree: WorktreeSelection;
  onAddRepo(): void;
  onOpenSettings(): void;
  onOpenPullRequest(pr: PullRequest): void;
}

// The queue's top bar, across the whole window: the title, the current tab's
// refresh, and the actions menu. It reads the same queries the panels below it
// do rather than taking them as props — they are shared cache entries, so a
// second observer is free and the alternative is threading query objects
// through the layout.
export default function QueueHeader({
  repo,
  tab,
  worktree,
  onAddRepo,
  onOpenSettings,
  onOpenPullRequest,
}: Props) {
  const queryClient = useQueryClient();
  // With the sidebar hidden its header is gone too, so this bar takes over
  // holding the window's traffic lights clear.
  const collapsed = useSidebarCollapsed();
  const slug = repo?.slug ?? undefined;

  const prsQuery = useQuery(pullRequestsQueryOptions(slug));
  const countQuery = useQuery({
    ...localChangeCountQueryOptions(worktree.path),
    enabled: Boolean(repo),
  });
  const changesQuery = useQuery({
    ...localChangesQueryOptions(worktree.path),
    enabled: Boolean(repo) && tab === "local-changes",
  });

  function openCreatedPullRequest(pr: PullRequest) {
    void queryClient.invalidateQueries({ queryKey: ["pullRequests", pr.repo] });
    void queryClient.invalidateQueries({ queryKey: ["myPullRequests"] });
    void queryClient.invalidateQueries({ queryKey: ["repoCounts"] });
    onOpenPullRequest(pr);
  }

  return (
    <HStack
      flexShrink="0"
      h={titleBarHeight}
      pl={collapsed ? trafficLightSpace : "4"}
      pr="3"
      gap="2"
      borderBottomWidth="1px"
      css={dragRegion}
    >
      <ShowSidebarButton />
      <Text fontSize="sm" fontWeight="semibold" truncate>
        Review queue
      </Text>
      <HStack ml="auto" gap="1" flexShrink="0">
        {repo && tab === "local-changes" && (
          <RefreshButton
            label="Refresh"
            loading={changesQuery.isFetching}
            onClick={() => {
              worktree.refetch();
              void countQuery.refetch();
              void changesQuery.refetch();
              // The commit list lives in the column below, so it is
              // invalidated rather than refetched from up here.
              void queryClient.invalidateQueries({
                queryKey: ["localCommits", worktree.path],
              });
            }}
          />
        )}
        {slug && tab === "pull-requests" && (
          <>
            <RefreshButton
              label="Refresh pull requests"
              loading={prsQuery.isFetching}
              onClick={() => {
                void prsQuery.refetch();
                void queryClient.invalidateQueries({
                  queryKey: ["repoCounts"],
                });
              }}
            />
            <NewPullRequestDialog
              key={slug}
              repo={slug}
              compact
              onCreated={openCreatedPullRequest}
            />
          </>
        )}
        <QueueActionsMenu
          repoSlug={slug}
          onAddRepo={onAddRepo}
          onOpenSettings={onOpenSettings}
        />
      </HStack>
    </HStack>
  );
}

// Every tab refreshes the same way, so they look and read the same way. The
// title is fixed: the aria-label carries what is being refreshed, for a reader
// who can't see which tab is open.
function RefreshButton({
  label,
  loading,
  onClick,
}: {
  label: string;
  loading: boolean;
  onClick(): void;
}) {
  return (
    <IconButton
      aria-label={label}
      title="Refresh"
      variant="ghost"
      size="xs"
      color="fg.muted"
      loading={loading}
      onClick={onClick}
    >
      <LuRefreshCw />
    </IconButton>
  );
}
