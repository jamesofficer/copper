import {
  Alert,
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
import { useState } from "react";
import {
  LuCircleDot,
  LuFileDiff,
  LuGitBranch,
  LuGitPullRequest,
  LuRefreshCw,
} from "react-icons/lu";
import type { PullRequest, RepoIssue, Repository } from "../../../shared/types";
import LocalChangesView, {
  localChangeCountQueryOptions,
  localChangesQueryOptions,
} from "../components/LocalChangesView";
import NewPullRequestDialog from "../components/NewPullRequestDialog";
import NoRepositoriesEmptyState from "../components/NoRepositoriesEmptyState";
import OpenPullRequestList from "../components/OpenPullRequestList";
import PullRequestPreview from "../components/PullRequestPreview";
import RepoIssueList from "../components/RepoIssueList";
import RepoIssuePreview from "../components/RepoIssuePreview";
import SetupBanner from "../components/SetupBanner";
import ShowSidebarButton from "../components/ShowSidebarButton";
import WorktreeSelect from "../components/WorktreeSelect";
import { scrollbar } from "../lib/scrollbar";
import { useSidebarCollapsed } from "../lib/sidebarCollapsed";
import { dragRegion, titleBarHeight, trafficLightSpace } from "../lib/titleBar";

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

  const localChangesTab = tab === "local-changes";
  const issuesTab = tab === "issues";
  const noRepositories =
    !reposPending && (!repositories || repositories.length === 0);

  // Only fetched while the tab is showing, so a user who never opens Issues
  // never spends the request. That's also why the trigger carries no count.
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

  function openCreatedPullRequest(pr: PullRequest) {
    void queryClient.invalidateQueries({ queryKey: ["pullRequests", pr.repo] });
    void queryClient.invalidateQueries({ queryKey: ["myPullRequests"] });
    void queryClient.invalidateQueries({ queryKey: ["openPrCounts"] });
    onSelect(pr);
  }

  return (
    <>
      <Flex direction="column" flex="1" minW="0">
        <Tabs.Root
          value={tab}
          onValueChange={(details) => setTab(details.value)}
          display="flex"
          flexDirection="column"
          flex="1"
          minH="0"
        >
          <HStack
            flexShrink="0"
            h={titleBarHeight}
            pl={collapsed ? trafficLightSpace : "4"}
            pr="4"
            gap="2"
            borderBottomWidth="1px"
            color="fg.muted"
            css={dragRegion}
          >
            <ShowSidebarButton />
            {/* A third tab plus the preview panel is enough to wrap the
                labels onto two lines, which fights the title bar's height. */}
            <Tabs.List
              h="full"
              border="none"
              alignItems="stretch"
              flexShrink="0"
              whiteSpace="nowrap"
            >
              <Tabs.Trigger value="pull-requests" h="full">
                <LuGitPullRequest /> Pull requests
              </Tabs.Trigger>
              <Tabs.Trigger value="issues" h="full">
                <LuCircleDot /> Issues
              </Tabs.Trigger>
              <Tabs.Trigger value="local-changes" h="full">
                <LuFileDiff /> Current changes
                {changedCount !== undefined ? ` (${changedCount})` : ""}
              </Tabs.Trigger>
            </Tabs.List>
            {active?.slug && tab === "pull-requests" && (
              <HStack ml="auto" gap="2">
                <IconButton
                  aria-label="Refresh pull requests"
                  title="Refresh"
                  variant="outline"
                  size="xs"
                  loading={prsQuery.isFetching}
                  onClick={() => {
                    void prsQuery.refetch();
                    void queryClient.invalidateQueries({
                      queryKey: ["openPrCounts"],
                    });
                  }}
                >
                  <LuRefreshCw />
                </IconButton>
                <NewPullRequestDialog
                  key={active.slug}
                  repo={active.slug}
                  onCreated={openCreatedPullRequest}
                />
              </HStack>
            )}
            {active?.slug && issuesTab && (
              <HStack ml="auto" gap="2">
                <IconButton
                  aria-label="Refresh issues"
                  title="Refresh"
                  variant="outline"
                  size="xs"
                  loading={issuesQuery.isFetching}
                  onClick={() => void issuesQuery.refetch()}
                >
                  <LuRefreshCw />
                </IconButton>
              </HStack>
            )}
            {active && localChangesTab && (
              <HStack ml="auto" gap="2">
                {worktrees && worktrees.length > 1 ? (
                  <WorktreeSelect
                    worktrees={worktrees}
                    value={worktreePath}
                    onChange={setSelectedWorktree}
                  />
                ) : (
                  changesQuery.data?.branch && (
                    <HStack gap="1" fontFamily="mono" fontSize="xs" minW="0">
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
                  variant="outline"
                  size="xs"
                  loading={changesQuery.isFetching}
                  onClick={() => {
                    void worktreesQuery.refetch();
                    void countQuery.refetch();
                    void changesQuery.refetch();
                  }}
                >
                  <LuRefreshCw />
                </IconButton>
              </HStack>
            )}
          </HStack>

          <Tabs.Content value="pull-requests" flex="1" minH="0" p="0">
            <Stack
              h="full"
              minH="0"
              overflowY="auto"
              gap="3"
              px="4"
              py="4"
              css={scrollbar}
            >
              <SetupBanner onOpenSettings={onOpenSettings} />

              {noRepositories ? (
                <NoRepositoriesEmptyState
                  purpose="start reviewing its pull requests"
                  onAddRepo={onAddRepo}
                />
              ) : (
                <>
                  {active && !active.slug && (
                    <Text fontSize="sm" color="fg.muted">
                      This repository has no GitHub remote, so pull requests
                      can’t be loaded.
                    </Text>
                  )}

                  {prsError && (
                    <Alert.Root status="error" rounded="lg" maxW="2xl">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>Couldn’t load pull requests</Alert.Title>
                        <Alert.Description>{prsError}</Alert.Description>
                      </Alert.Content>
                    </Alert.Root>
                  )}

                  {active?.slug &&
                    !prsError &&
                    (prsQuery.isPending || !prs ? (
                      <HStack color="fg.muted" py="4">
                        <Spinner size="sm" />
                        <Text fontSize="sm">Loading open pull requests…</Text>
                      </HStack>
                    ) : prs.length === 0 ? (
                      <Text fontSize="sm" color="fg.muted" py="4">
                        No open pull requests. Nice and quiet.
                      </Text>
                    ) : (
                      <OpenPullRequestList
                        key={active.slug}
                        prs={prs}
                        preview={preview}
                        onSelect={onPreviewChange}
                        onOpen={onSelect}
                      />
                    ))}
                </>
              )}
            </Stack>
          </Tabs.Content>

          <Tabs.Content value="issues" flex="1" minH="0" p="0">
            <Stack
              h="full"
              minH="0"
              overflowY="auto"
              gap="3"
              px="4"
              py="4"
              css={scrollbar}
            >
              <SetupBanner onOpenSettings={onOpenSettings} />

              {noRepositories ? (
                <NoRepositoriesEmptyState
                  purpose="see its issues"
                  onAddRepo={onAddRepo}
                />
              ) : (
                <>
                  {active && !active.slug && (
                    <Text fontSize="sm" color="fg.muted">
                      This repository has no GitHub remote, so issues can’t be
                      loaded.
                    </Text>
                  )}

                  {issuesError && (
                    <Alert.Root status="error" rounded="lg" maxW="2xl">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>Couldn’t load issues</Alert.Title>
                        <Alert.Description>{issuesError}</Alert.Description>
                      </Alert.Content>
                    </Alert.Root>
                  )}

                  {active?.slug &&
                    !issuesError &&
                    (issuesQuery.isPending || !issues ? (
                      <HStack color="fg.muted" py="4">
                        <Spinner size="sm" />
                        <Text fontSize="sm">Loading open issues…</Text>
                      </HStack>
                    ) : issues.length === 0 ? (
                      <Text fontSize="sm" color="fg.muted" py="4">
                        No open issues. Nothing to fix.
                      </Text>
                    ) : (
                      <RepoIssueList
                        key={active.slug}
                        issues={issues}
                        preview={shownIssue}
                        onSelect={setPreviewIssue}
                      />
                    ))}
                </>
              )}
            </Stack>
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
      </Flex>

      {tab === "pull-requests" && preview && (
        <PullRequestPreview
          pr={preview}
          onView={onSelect}
          onClose={() => onPreviewChange(null)}
        />
      )}

      {issuesTab && shownIssue && (
        <RepoIssuePreview
          issue={shownIssue}
          onClose={() => setPreviewIssue(null)}
        />
      )}
    </>
  );
}
