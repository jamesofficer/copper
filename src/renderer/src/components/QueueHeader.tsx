import { Badge, HStack, IconButton, Tabs, Text } from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LuGitBranch, LuRefreshCw } from "react-icons/lu";
import type { PullRequest, Repository } from "../../../shared/types";
import {
  pullRequestsQueryOptions,
  repoCountsQueryOptions,
  repoIssuesQueryOptions,
} from "../lib/repoQueries";
import { useSidebarCollapsed } from "../lib/sidebarCollapsed";
import { dragRegion, titleBarHeight, trafficLightSpace } from "../lib/titleBar";
import type { WorktreeSelection } from "../lib/useWorktreeSelection";
import {
  localChangeCountQueryOptions,
  localChangesQueryOptions,
} from "./LocalChangesView";
import NewPullRequestDialog from "./NewPullRequestDialog";
import QueueActionsMenu from "./QueueActionsMenu";
import ShowSidebarButton from "./ShowSidebarButton";
import WorktreeSelect from "./WorktreeSelect";

export type QueueTab = "pull-requests" | "issues" | "local-changes";

interface Props {
  repo: Repository | null;
  tab: QueueTab;
  worktree: WorktreeSelection;
  onAddRepo(): void;
  onOpenSettings(): void;
  onOpenPullRequest(pr: PullRequest): void;
}

// The queue's chrome: the top bar and the tab triggers. It reads the same
// queries the panels below it do rather than taking them as props — they are
// shared cache entries, so a second observer is free and the alternative is
// threading four query objects through the layout.
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
  const issuesQuery = useQuery(repoIssuesQueryOptions(slug, tab === "issues"));
  const countsQuery = useQuery(repoCountsQueryOptions());

  // The always-visible badge uses porcelain status only. Building every file
  // patch is deferred until Current changes opens, where LocalChangesView is the
  // other observer of the detailed query.
  const countQuery = useQuery({
    ...localChangeCountQueryOptions(worktree.path),
    enabled: Boolean(repo),
  });
  const changesQuery = useQuery({
    ...localChangesQueryOptions(worktree.path),
    enabled: Boolean(repo) && tab === "local-changes",
  });

  const counts = slug ? countsQuery.data?.[slug] : undefined;

  function openCreatedPullRequest(pr: PullRequest) {
    void queryClient.invalidateQueries({ queryKey: ["pullRequests", pr.repo] });
    void queryClient.invalidateQueries({ queryKey: ["myPullRequests"] });
    void queryClient.invalidateQueries({ queryKey: ["repoCounts"] });
    onOpenPullRequest(pr);
  }

  return (
    <>
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
            <>
              {worktree.worktrees && worktree.worktrees.length > 1 ? (
                <WorktreeSelect
                  worktrees={worktree.worktrees}
                  value={worktree.path}
                  onChange={worktree.select}
                />
              ) : (
                changesQuery.data?.branch && (
                  <BranchLabel name={changesQuery.data.branch} />
                )
              )}
              <RefreshButton
                label="Refresh"
                loading={changesQuery.isFetching}
                onClick={() => {
                  worktree.refetch();
                  void countQuery.refetch();
                  void changesQuery.refetch();
                }}
              />
            </>
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
          {slug && tab === "issues" && (
            <RefreshButton
              label="Refresh issues"
              loading={issuesQuery.isFetching}
              onClick={() => void issuesQuery.refetch()}
            />
          )}
          <QueueActionsMenu
            repoSlug={slug}
            onAddRepo={onAddRepo}
            onOpenSettings={onOpenSettings}
          />
        </HStack>
      </HStack>

      {/* No icons on the triggers: the column is narrow, and the counts are
          the part that says where the work is. The loaded lists are the
          fallback, for a repo the counts query couldn't reach (no token, no
          access). */}
      <Tabs.List
        flexShrink="0"
        px="4"
        border="none"
        gap="4"
        whiteSpace="nowrap"
      >
        <Tabs.Trigger value="pull-requests" px="0" py="2.5">
          Open
          <TabCount value={counts?.pullRequests ?? prsQuery.data?.length} />
        </Tabs.Trigger>
        <Tabs.Trigger value="issues" px="0" py="2.5">
          Issues
          <TabCount value={counts?.issues ?? issuesQuery.data?.length} />
        </Tabs.Trigger>
        <Tabs.Trigger value="local-changes" px="0" py="2.5">
          Changes
          <TabCount value={countQuery.data} />
        </Tabs.Trigger>
      </Tabs.List>
    </>
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

// Shown in place of the worktree switcher when the repo has only one checkout.
function BranchLabel({ name }: { name: string }) {
  return (
    <HStack gap="1" fontFamily="mono" fontSize="xs" color="fg.muted" minW="0">
      <LuGitBranch size={12} />
      <Text as="span" truncate>
        {name}
      </Text>
    </HStack>
  );
}

function TabCount({ value }: { value?: number }) {
  if (value === undefined) return null;
  return (
    <Badge size="xs" variant="surface" colorPalette="gray">
      {value}
    </Badge>
  );
}
