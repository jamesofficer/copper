import {
  Alert,
  Badge,
  Box,
  Center,
  Flex,
  HStack,
  IconButton,
  Spinner,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { LuGitBranch, LuRefreshCw } from "react-icons/lu";
import type { PullRequest, RepoIssue, Repository } from "../../../shared/types";
import LocalChangesView, {
  localChangeCountQueryOptions,
  localChangesQueryOptions,
} from "../components/LocalChangesView";
import NewPullRequestDialog from "../components/NewPullRequestDialog";
import NoRepositoriesEmptyState from "../components/NoRepositoriesEmptyState";
import OpenPullRequestList from "../components/OpenPullRequestList";
import PullRequestPreview from "../components/PullRequestPreview";
import QueueActionsMenu from "../components/QueueActionsMenu";
import RepoIssueList from "../components/RepoIssueList";
import RepoIssuePreview from "../components/RepoIssuePreview";
import SetupBanner from "../components/SetupBanner";
import ShowSidebarButton from "../components/ShowSidebarButton";
import WorktreeSelect from "../components/WorktreeSelect";
import { scrollbar } from "../lib/scrollbar";
import { useSidebarCollapsed } from "../lib/sidebarCollapsed";
import { dragRegion, titleBarHeight, trafficLightSpace } from "../lib/titleBar";
import { usePanelWidth } from "../lib/usePanelWidth";

interface Props {
  repositories: Repository[] | undefined;
  reposPending: boolean;
  activeRepo: Repository | null;
  onAddRepo(): void;
  onSelect(pr: PullRequest): void;
  preview: PullRequest | null;
  onPreviewChange(pr: PullRequest | null): void;
  onOpenSettings(): void;
}

export default function Welcome({
  repositories,
  reposPending,
  activeRepo: active,
  onAddRepo,
  onSelect,
  preview,
  onPreviewChange,
  onOpenSettings,
}: Props) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("pull-requests");
  // With the sidebar hidden its header is gone too, so this bar takes over
  // holding the window's traffic lights clear.
  const collapsed = useSidebarCollapsed();

  // The queue is a list read top to bottom, so it stays narrow and hands the
  // rest of the window to whatever is being read beside it.
  const { width: queueWidth, startResize } = usePanelWidth({
    storageKey: "reviewQueueWidth",
    min: 380,
    max: 700,
    fallback: 480,
    handle: "right",
  });

  const prsQuery = useQuery({
    queryKey: ["pullRequests", active?.slug],
    queryFn: () => window.api.listPullRequests(active?.slug ?? ""),
    enabled: Boolean(active?.slug),
  });
  const prs = prsQuery.data;
  const prsError = prsQuery.error
    ? prsQuery.error instanceof Error
      ? prsQuery.error.message
      : "Couldn't load pull requests."
    : null;

  const pullRequestsTab = tab === "pull-requests";
  const localChangesTab = tab === "local-changes";
  const issuesTab = tab === "issues";
  // Only the two list tabs share the window with a panel beside them; Current
  // changes is a file list and a diff, and needs the whole width.
  const listTab = pullRequestsTab || issuesTab;
  const noRepositories =
    !reposPending && (!repositories || repositories.length === 0);

  // Only fetched while the tab is showing, so a user who never opens Issues
  // never spends the request.
  const issuesQuery = useQuery({
    queryKey: ["repoIssues", active?.slug],
    queryFn: () => window.api.listRepoIssues(active?.slug ?? ""),
    enabled: Boolean(active?.slug) && issuesTab,
  });
  const issues = issuesQuery.data;
  const issuesError = issuesQuery.error
    ? issuesQuery.error instanceof Error
      ? issuesQuery.error.message
      : "Couldn't load issues."
    : null;

  // Kept here rather than in App: unlike the PR preview it has no full screen
  // to survive a trip to, so it never needs to outlive this screen.
  const [previewIssue, setPreviewIssue] = useState<RepoIssue | null>(null);
  // Guarding on the slug drops a panel left over from the previous repo
  // without an effect to clear it.
  const shownIssue =
    previewIssue && previewIssue.repo === active?.slug ? previewIssue : null;

  // The repo's checkouts — main worktree plus any linked git worktrees, so
  // Current changes can jump between agents working in parallel. Worktrees
  // come and go while the app runs, so never trust a cached list.
  const worktreesQuery = useQuery({
    queryKey: ["worktrees", active?.path],
    queryFn: () => window.api.listWorktrees(active?.path ?? ""),
    enabled: Boolean(active),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const worktrees = worktreesQuery.data;

  // Which checkout the tab reads. The selection only sticks while it names a
  // listed worktree, so switching repos or removing a worktree falls back to
  // the registered path on its own.
  const [selectedWorktree, setSelectedWorktree] = useState<string | null>(null);
  const worktreePath =
    selectedWorktree &&
    worktrees?.some((worktree) => worktree.path === selectedWorktree)
      ? selectedWorktree
      : (active?.path ?? "");

  // The always-visible badge uses porcelain status only. Building every file
  // patch is deferred until Current changes opens, where this second observer
  // shares LocalChangesView's detailed query.
  const countQuery = useQuery({
    ...localChangeCountQueryOptions(worktreePath),
    enabled: Boolean(active),
  });
  const changesQuery = useQuery({
    ...localChangesQueryOptions(worktreePath),
    enabled: Boolean(active) && localChangesTab,
  });
  const changedCount = countQuery.data;

  // GitHub's own open totals for every registered repo, in one request the
  // sidebar already makes (observed here too, since the sidebar can be hidden).
  // This is what puts a count on the Issues tab without opening it — and it's
  // truer than the loaded lists, which are capped at 50.
  const countsQuery = useQuery({
    queryKey: ["repoCounts"],
    queryFn: () => window.api.getRepoCounts(),
  });
  const repoCounts = active?.slug ? countsQuery.data?.[active.slug] : undefined;

  function openCreatedPullRequest(pr: PullRequest) {
    void queryClient.invalidateQueries({ queryKey: ["pullRequests", pr.repo] });
    void queryClient.invalidateQueries({ queryKey: ["myPullRequests"] });
    void queryClient.invalidateQueries({ queryKey: ["repoCounts"] });
    onSelect(pr);
  }

  return (
    <>
      <Tabs.Root
        value={tab}
        onValueChange={(details) => setTab(details.value)}
        display="flex"
        flexDirection="column"
        // Fixed width beside a panel; the whole remaining window otherwise.
        flex={listTab ? undefined : "1"}
        flexShrink="0"
        minW="0"
        // The stored width can't crush the panel beside it: on a narrow window
        // the queue gives way, leaving the preview the 45% the old fixed split
        // gave it.
        maxW={listTab ? "55%" : undefined}
        minH="0"
        style={listTab ? { width: queueWidth } : undefined}
      >
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
            {active && localChangesTab && (
              <>
                {worktrees && worktrees.length > 1 ? (
                  <WorktreeSelect
                    worktrees={worktrees}
                    value={worktreePath}
                    onChange={setSelectedWorktree}
                  />
                ) : (
                  changesQuery.data?.branch && (
                    <HStack
                      gap="1"
                      fontFamily="mono"
                      fontSize="xs"
                      color="fg.muted"
                      minW="0"
                    >
                      <LuGitBranch size={12} />
                      <Text as="span" truncate>
                        {changesQuery.data.branch}
                      </Text>
                    </HStack>
                  )
                )}
                <IconButton
                  aria-label="Refresh"
                  title="Refresh"
                  variant="ghost"
                  size="xs"
                  color="fg.muted"
                  loading={changesQuery.isFetching}
                  onClick={() => {
                    void worktreesQuery.refetch();
                    void countQuery.refetch();
                    void changesQuery.refetch();
                  }}
                >
                  <LuRefreshCw />
                </IconButton>
              </>
            )}
            {active?.slug && pullRequestsTab && (
              <>
                <IconButton
                  aria-label="Refresh pull requests"
                  title="Refresh"
                  variant="ghost"
                  size="xs"
                  color="fg.muted"
                  loading={prsQuery.isFetching}
                  onClick={() => {
                    void prsQuery.refetch();
                    void queryClient.invalidateQueries({
                      queryKey: ["repoCounts"],
                    });
                  }}
                >
                  <LuRefreshCw />
                </IconButton>
                <NewPullRequestDialog
                  key={active.slug}
                  repo={active.slug}
                  compact
                  onCreated={openCreatedPullRequest}
                />
              </>
            )}
            {active?.slug && issuesTab && (
              <IconButton
                aria-label="Refresh issues"
                title="Refresh"
                variant="ghost"
                size="xs"
                color="fg.muted"
                loading={issuesQuery.isFetching}
                onClick={() => void issuesQuery.refetch()}
              >
                <LuRefreshCw />
              </IconButton>
            )}
            <QueueActionsMenu
              repoSlug={active?.slug ?? undefined}
              onAddRepo={onAddRepo}
              onOpenSettings={onOpenSettings}
            />
          </HStack>
        </HStack>

        {/* No icons on the triggers: the column is narrow, and the counts are
            the part that says where the work is. */}
        <Tabs.List
          flexShrink="0"
          px="4"
          border="none"
          gap="4"
          whiteSpace="nowrap"
        >
          {/* The loaded lists are the fallback, for a repo the counts query
              couldn't reach (no token, no access). */}
          <Tabs.Trigger value="pull-requests" px="0" py="2.5">
            Open
            <TabCount value={repoCounts?.pullRequests ?? prs?.length} />
          </Tabs.Trigger>
          <Tabs.Trigger value="issues" px="0" py="2.5">
            Issues
            <TabCount value={repoCounts?.issues ?? issues?.length} />
          </Tabs.Trigger>
          <Tabs.Trigger value="local-changes" px="0" py="2.5">
            Changes
            <TabCount value={changedCount} />
          </Tabs.Trigger>
        </Tabs.List>

        {/* Collapses to nothing on the usual path: the banner renders null once
            both credentials are set, and :empty takes the padding with it. */}
        <Box px="4" pt="2" flexShrink="0" _empty={{ display: "none" }}>
          <SetupBanner onOpenSettings={onOpenSettings} />
        </Box>

        <Tabs.Content value="pull-requests" flex="1" minH="0" p="0">
          <Flex direction="column" h="full" minH="0">
            {noRepositories ? (
              <QueueMessage>
                <NoRepositoriesEmptyState
                  purpose="start reviewing its pull requests"
                  onAddRepo={onAddRepo}
                />
              </QueueMessage>
            ) : active && !active.slug ? (
              <QueueMessage>
                <Text fontSize="sm" color="fg.muted">
                  This repository has no GitHub remote, so pull requests can’t
                  be loaded.
                </Text>
              </QueueMessage>
            ) : prsError ? (
              <QueueMessage>
                <Alert.Root status="error" rounded="lg">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>Couldn’t load pull requests</Alert.Title>
                    <Alert.Description>{prsError}</Alert.Description>
                  </Alert.Content>
                </Alert.Root>
              </QueueMessage>
            ) : !active?.slug ? null : prsQuery.isPending || !prs ? (
              <QueueMessage>
                <HStack color="fg.muted">
                  <Spinner size="sm" />
                  <Text fontSize="sm">Loading open pull requests…</Text>
                </HStack>
              </QueueMessage>
            ) : prs.length === 0 ? (
              <QueueMessage>
                <Text fontSize="sm" color="fg.muted">
                  No open pull requests. Nice and quiet.
                </Text>
              </QueueMessage>
            ) : (
              <OpenPullRequestList
                key={active.slug}
                prs={prs}
                preview={preview}
                onSelect={onPreviewChange}
                onOpen={onSelect}
              />
            )}
          </Flex>
        </Tabs.Content>

        <Tabs.Content value="issues" flex="1" minH="0" p="0">
          <Flex direction="column" h="full" minH="0">
            {noRepositories ? (
              <QueueMessage>
                <NoRepositoriesEmptyState
                  purpose="see its issues"
                  onAddRepo={onAddRepo}
                />
              </QueueMessage>
            ) : active && !active.slug ? (
              <QueueMessage>
                <Text fontSize="sm" color="fg.muted">
                  This repository has no GitHub remote, so issues can’t be
                  loaded.
                </Text>
              </QueueMessage>
            ) : issuesError ? (
              <QueueMessage>
                <Alert.Root status="error" rounded="lg">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>Couldn’t load issues</Alert.Title>
                    <Alert.Description>{issuesError}</Alert.Description>
                  </Alert.Content>
                </Alert.Root>
              </QueueMessage>
            ) : !active?.slug ? null : issuesQuery.isPending || !issues ? (
              <QueueMessage>
                <HStack color="fg.muted">
                  <Spinner size="sm" />
                  <Text fontSize="sm">Loading open issues…</Text>
                </HStack>
              </QueueMessage>
            ) : issues.length === 0 ? (
              <QueueMessage>
                <Text fontSize="sm" color="fg.muted">
                  No open issues. Nothing to fix.
                </Text>
              </QueueMessage>
            ) : (
              <RepoIssueList
                key={active.slug}
                issues={issues}
                preview={shownIssue}
                onSelect={setPreviewIssue}
              />
            )}
          </Flex>
        </Tabs.Content>

        <Tabs.Content value="local-changes" flex="1" minH="0" p="0">
          {active ? (
            localChangesTab ? (
              <LocalChangesView key={worktreePath} path={worktreePath} />
            ) : null
          ) : (
            <Center h="full" p="4">
              <Text color="fg.muted" fontSize="sm">
                Select a repository to see its uncommitted changes.
              </Text>
            </Center>
          )}
        </Tabs.Content>
      </Tabs.Root>

      {listTab && (
        <Box
          w="1"
          flexShrink="0"
          cursor="col-resize"
          borderLeftWidth="1px"
          onPointerDown={startResize}
          _hover={{ bg: "border.emphasized" }}
          transition="background 0.15s"
        />
      )}

      {pullRequestsTab &&
        (preview ? (
          <PullRequestPreview
            pr={preview}
            onView={onSelect}
            onClose={() => onPreviewChange(null)}
          />
        ) : (
          <QueuePlaceholder text="Pick a pull request to read it here." />
        ))}

      {issuesTab &&
        (shownIssue ? (
          <RepoIssuePreview
            issue={shownIssue}
            onClose={() => setPreviewIssue(null)}
          />
        ) : (
          <QueuePlaceholder text="Pick an issue to read it here." />
        ))}
    </>
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

// Anything the queue shows in place of rows — an empty state, an error, the
// loading line. Scrolls, since a repo with no GitHub remote still gets a
// paragraph and a button.
function QueueMessage({ children }: { children: ReactNode }) {
  return (
    <Box flex="1" minH="0" overflowY="auto" px="4" py="4" css={scrollbar}>
      <Stack gap="3">{children}</Stack>
    </Box>
  );
}

function QueuePlaceholder({ text }: { text: string }) {
  return (
    <Center flex="1" minW="0" p="6">
      <Text fontSize="sm" color="fg.muted">
        {text}
      </Text>
    </Center>
  );
}
