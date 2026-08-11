import { Box, Center, Flex, Tabs, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { PullRequest, RepoIssue, Repository } from "../../../shared/types";
import LocalChangesView from "../components/LocalChangesView";
import OpenPullRequestList from "../components/OpenPullRequestList";
import PullRequestPreview from "../components/PullRequestPreview";
import QueueHeader, { type QueueTab } from "../components/QueueHeader";
import QueueListState from "../components/QueueListState";
import RepoIssueList from "../components/RepoIssueList";
import RepoIssuePreview from "../components/RepoIssuePreview";
import ResizeHandle from "../components/ResizeHandle";
import SetupBanner from "../components/SetupBanner";
import { errorText } from "../lib/ipcError";
import {
  pullRequestsQueryOptions,
  repoIssuesQueryOptions,
} from "../lib/repoQueries";
import { usePanelWidth } from "../lib/usePanelWidth";
import { useWorktreeSelection } from "../lib/useWorktreeSelection";
import type { ReviewTab } from "./Review";

interface Props {
  repositories: Repository[] | undefined;
  reposPending: boolean;
  activeRepo: Repository | null;
  onAddRepo(): void;
  onSelect(pr: PullRequest, tab?: ReviewTab): void;
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
  const [tab, setTab] = useState<QueueTab>("pull-requests");
  const worktree = useWorktreeSelection(active);
  // Kept here rather than in App: unlike the PR preview it has no full screen
  // to survive a trip to, so it never needs to outlive this screen.
  const [previewIssue, setPreviewIssue] = useState<RepoIssue | null>(null);

  // The queue is a list read top to bottom, so it stays narrow and hands the
  // rest of the window to whatever is being read beside it.
  const { width: queueWidth, startResize } = usePanelWidth({
    storageKey: "reviewQueueWidth",
    min: 380,
    max: 700,
    fallback: 480,
    handle: "right",
  });

  const pullRequestsTab = tab === "pull-requests";
  const issuesTab = tab === "issues";
  const localChangesTab = tab === "local-changes";
  // Only the two list tabs share the window with a panel beside them; Current
  // changes is a file list and a diff, and needs the whole width.
  const listTab = pullRequestsTab || issuesTab;
  const noRepositories =
    !reposPending && (!repositories || repositories.length === 0);

  const slug = active?.slug ?? undefined;
  const prsQuery = useQuery(pullRequestsQueryOptions(slug));
  const prs = prsQuery.data;
  const issuesQuery = useQuery(repoIssuesQueryOptions(slug, issuesTab));
  const issues = issuesQuery.data;

  // Guarding on the slug drops a panel left over from the previous repo
  // without an effect to clear it.
  const shownIssue =
    previewIssue && previewIssue.repo === active?.slug ? previewIssue : null;

  return (
    <>
      <Tabs.Root
        value={tab}
        onValueChange={(details) => setTab(details.value as QueueTab)}
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
        <QueueHeader
          repo={active}
          tab={tab}
          worktree={worktree}
          onAddRepo={onAddRepo}
          onOpenSettings={onOpenSettings}
          onOpenPullRequest={onSelect}
        />

        {/* Collapses to nothing on the usual path: the banner renders null once
            both credentials are set, and :empty takes the padding with it. */}
        <Box px="4" pt="2" flexShrink="0" _empty={{ display: "none" }}>
          <SetupBanner onOpenSettings={onOpenSettings} />
        </Box>

        <Tabs.Content value="pull-requests" flex="1" minH="0" p="0">
          <Flex direction="column" h="full" minH="0">
            <QueueListState
              noun="pull requests"
              noRepositories={noRepositories}
              addRepoPurpose="start reviewing its pull requests"
              onAddRepo={onAddRepo}
              repo={active}
              error={
                prsQuery.error
                  ? errorText(prsQuery.error, "Couldn't load pull requests.")
                  : null
              }
              pending={prsQuery.isPending || !prs}
              empty={prs?.length === 0}
              emptyText="No open pull requests. Nice and quiet."
            >
              <OpenPullRequestList
                key={active?.slug}
                prs={prs ?? []}
                preview={preview}
                onSelect={onPreviewChange}
                onOpen={onSelect}
              />
            </QueueListState>
          </Flex>
        </Tabs.Content>

        <Tabs.Content value="issues" flex="1" minH="0" p="0">
          <Flex direction="column" h="full" minH="0">
            <QueueListState
              noun="issues"
              noRepositories={noRepositories}
              addRepoPurpose="see its issues"
              onAddRepo={onAddRepo}
              repo={active}
              error={
                issuesQuery.error
                  ? errorText(issuesQuery.error, "Couldn't load issues.")
                  : null
              }
              pending={issuesQuery.isPending || !issues}
              empty={issues?.length === 0}
              emptyText="No open issues. Nothing to fix."
            >
              <RepoIssueList
                key={active?.slug}
                issues={issues ?? []}
                preview={shownIssue}
                onSelect={setPreviewIssue}
              />
            </QueueListState>
          </Flex>
        </Tabs.Content>

        <Tabs.Content value="local-changes" flex="1" minH="0" p="0">
          {!active ? (
            <Center h="full" p="4">
              <Text color="fg.muted" fontSize="sm">
                Select a repository to see its uncommitted changes.
              </Text>
            </Center>
          ) : localChangesTab ? (
            <LocalChangesView key={worktree.path} path={worktree.path} />
          ) : null}
        </Tabs.Content>
      </Tabs.Root>

      {listTab && <ResizeHandle onPointerDown={startResize} border />}

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

function QueuePlaceholder({ text }: { text: string }) {
  return (
    <Center flex="1" minW="0" p="6">
      <Text fontSize="sm" color="fg.muted">
        {text}
      </Text>
    </Center>
  );
}
