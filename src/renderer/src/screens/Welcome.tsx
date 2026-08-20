import { Box, Center, Flex, Tabs, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { PullRequest, Repository } from "../../../shared/types";
import LocalChangesColumn from "../components/LocalChangesColumn";
import LocalChangesPane from "../components/LocalChangesPane";
import OpenPullRequestList from "../components/OpenPullRequestList";
import PullRequestPreview from "../components/PullRequestPreview";
import QueueHeader, { type QueueView } from "../components/QueueHeader";
import QueueListState from "../components/QueueListState";
import QueueTabs from "../components/QueueTabs";
import ResizeHandle from "../components/ResizeHandle";
import SetupBanner from "../components/SetupBanner";
import { errorText } from "../lib/ipcError";
import { pullRequestsQueryOptions } from "../lib/repoQueries";
import type { ReviewTab } from "../lib/tabs/tabs";
import {
  localChangesFileListPanel,
  useLocalChanges,
} from "../lib/useLocalChanges";
import { usePanelWidth } from "../lib/usePanelWidth";
import { useWorktreeSelection } from "../lib/useWorktreeSelection";

interface Props {
  repositories: Repository[] | undefined;
  reposPending: boolean;
  activeRepo: Repository | null;
  onAddRepo(): void;
  onSelect(pr: PullRequest, tab?: ReviewTab): void;
  onOpenIssues(repo: Repository): void;
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
  onOpenIssues,
  preview,
  onPreviewChange,
  onOpenSettings,
}: Props) {
  const [tab, setTab] = useState<QueueView>("pull-requests");
  const worktree = useWorktreeSelection(active);

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
  const localChangesTab = tab === "local-changes";

  // The Changes tab has a column of its own: narrower, and resized separately
  // from the queue's lists.
  const { width: fileListWidth, startResize: startFileListResize } =
    usePanelWidth({ ...localChangesFileListPanel, handle: "right" });
  const localChanges = useLocalChanges(worktree, localChangesTab);

  const noRepositories =
    !reposPending && (!repositories || repositories.length === 0);

  const slug = active?.slug ?? undefined;
  const prsQuery = useQuery(pullRequestsQueryOptions(slug));
  const prs = prsQuery.data;

  function changeTab(next: string) {
    if (next === "issues") {
      if (active) onOpenIssues(active);
      return;
    }
    if (next === "pull-requests" || next === "local-changes") setTab(next);
  }

  return (
    <>
      <Tabs.Root
        value={tab}
        onValueChange={(details) => changeTab(details.value)}
        display="flex"
        flexDirection="column"
        // Fixed width beside a panel; the whole remaining window otherwise.
        flex={pullRequestsTab ? undefined : "1"}
        flexShrink="0"
        minW="0"
        // The stored width can't crush the panel beside it: on a narrow window
        // the queue gives way, leaving the preview the 45% the old fixed split
        // gave it.
        maxW={pullRequestsTab ? "55%" : undefined}
        minH="0"
        style={pullRequestsTab ? { width: queueWidth } : undefined}
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

        {pullRequestsTab && (
          <QueueTabs repo={active} checkoutPath={worktree.path} />
        )}

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

        {/* The Changes tab splits below the top bar, not below the tab bar:
            the tabs cap the file-list column, so the diff beside them runs the
            full height of the window. */}
        {/* Gated on the tab being open, not just rendered inside its panel:
            an inactive Tabs.Content is still mounted, so a second copy of the
            tab bar would sit in the tree with the same trigger ids. */}
        <Tabs.Content value="local-changes" flex="1" minH="0" p="0">
          {!localChangesTab ? null : !active ? (
            <Flex direction="column" h="full" minH="0">
              <QueueTabs repo={active} checkoutPath={worktree.path} />
              <Center flex="1" p="4">
                <Text color="fg.muted" fontSize="sm">
                  Select a repository to see its uncommitted changes.
                </Text>
              </Center>
            </Flex>
          ) : localChangesTab ? (
            <Flex h="full" minH="0">
              <Flex
                direction="column"
                minH="0"
                minW="0"
                flexShrink="0"
                style={{ width: fileListWidth }}
              >
                <QueueTabs repo={active} checkoutPath={worktree.path} />
                <LocalChangesColumn state={localChanges} />
              </Flex>
              <ResizeHandle onPointerDown={startFileListResize} border />
              <LocalChangesPane state={localChanges} />
            </Flex>
          ) : null}
        </Tabs.Content>
      </Tabs.Root>

      {pullRequestsTab && <ResizeHandle onPointerDown={startResize} border />}

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
