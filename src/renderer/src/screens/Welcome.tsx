import { Box, Center, Flex, Tabs, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import type { PullRequest, Repository } from "../../../shared/types";
import OpenPullRequestList from "../components/OpenPullRequestList";
import PullRequestPreview from "../components/PullRequestPreview";
import QueueHeader from "../components/QueueHeader";
import QueueListState from "../components/QueueListState";
import QueueTabs from "../components/QueueTabs";
import ResizeHandle from "../components/ResizeHandle";
import SetupBanner from "../components/SetupBanner";
import { errorText } from "../lib/ipcError";
import { pullRequestsQueryOptions } from "../lib/repoQueries";
import type { ReviewTab } from "../lib/tabs/tabs";
import { usePanelWidth } from "../lib/usePanelWidth";

interface Props {
  repositories: Repository[] | undefined;
  reposPending: boolean;
  activeRepo: Repository | null;
  onAddRepo(): void;
  onSelect(pr: PullRequest, tab?: ReviewTab): void;
  onOpenIssues(repo: Repository): void;
  onOpenLocalChanges(repo: Repository): void;
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
  onOpenLocalChanges,
  preview,
  onPreviewChange,
  onOpenSettings,
}: Props) {
  // The queue is a list read top to bottom, so it stays narrow and hands the
  // rest of the window to whatever is being read beside it.
  const { width: queueWidth, startResize } = usePanelWidth({
    storageKey: "reviewQueueWidth",
    min: 380,
    max: 700,
    fallback: 480,
    handle: "right",
  });
  const noRepositories =
    !reposPending && (!repositories || repositories.length === 0);
  const slug = active?.slug ?? undefined;
  const prsQuery = useQuery(pullRequestsQueryOptions(slug));
  const prs = prsQuery.data;

  function openDestination(next: string) {
    if (!active) return;
    if (next === "issues") onOpenIssues(active);
    if (next === "local-changes") onOpenLocalChanges(active);
  }

  return (
    <>
      <Tabs.Root
        value="pull-requests"
        onValueChange={(details) => openDestination(details.value)}
        display="flex"
        flexDirection="column"
        flexShrink="0"
        minW="0"
        maxW="55%"
        minH="0"
        style={{ width: queueWidth }}
      >
        <QueueHeader
          repo={active}
          onAddRepo={onAddRepo}
          onOpenSettings={onOpenSettings}
          onOpenPullRequest={onSelect}
        />

        {/* Collapses to nothing on the usual path: the banner renders null once
            both credentials are set, and :empty takes the padding with it. */}
        <Box px="4" pt="2" flexShrink="0" _empty={{ display: "none" }}>
          <SetupBanner onOpenSettings={onOpenSettings} />
        </Box>

        <QueueTabs repo={active} checkoutPath={active?.path ?? ""} />

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
      </Tabs.Root>

      <ResizeHandle onPointerDown={startResize} border />

      {preview ? (
        <PullRequestPreview
          pr={preview}
          onView={onSelect}
          onClose={() => onPreviewChange(null)}
        />
      ) : (
        <Center flex="1" minW="0" p="6">
          <Text fontSize="sm" color="fg.muted">
            Pick a pull request to read it here.
          </Text>
        </Center>
      )}
    </>
  );
}
