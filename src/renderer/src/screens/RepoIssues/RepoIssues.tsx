import { Box, Center, Flex, HStack, IconButton, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { LuRefreshCw } from "react-icons/lu";
import type { RepoIssue } from "../../../../shared/types";
import QueueActionsMenu from "../../components/QueueActionsMenu";
import QueueListState from "../../components/QueueListState";
import RepoIssueList from "../../components/RepoIssueList";
import RepoIssuePreview from "../../components/RepoIssuePreview";
import ResizeHandle from "../../components/ResizeHandle";
import SetupBanner from "../../components/SetupBanner";
import { errorText } from "../../lib/ipcError";
import { repoIssuesQueryOptions } from "../../lib/repoQueries";
import type { RepoIssuesTab, RepoIssuesTabUi } from "../../lib/tabs/tabs";
import { dragRegion, noDragRegion, titleBarHeight } from "../../lib/titleBar";
import { usePanelWidth } from "../../lib/usePanelWidth";

interface Props {
  tab: RepoIssuesTab;
  onUiChange(patch: Partial<RepoIssuesTabUi>): void;
  onAddRepo(): void;
  onOpenSettings(): void;
}

// A repository's issue list and reading panel. The tab owns its selected issue,
// filters and page. The query cache owns the issue data.
export default function RepoIssues({
  tab,
  onUiChange,
  onAddRepo,
  onOpenSettings,
}: Props) {
  const { width, startResize } = usePanelWidth({
    storageKey: "reviewQueueWidth",
    min: 380,
    max: 700,
    fallback: 480,
    handle: "right",
  });
  const slug = tab.repo.slug ?? undefined;
  const issuesQuery = useQuery(repoIssuesQueryOptions(slug, true));
  const issues = issuesQuery.data;
  const selectedIssue =
    issues?.find((issue) => issue.number === tab.ui.selectedIssueNumber) ??
    null;

  function selectIssue(issue: RepoIssue) {
    onUiChange({ selectedIssueNumber: issue.number });
  }

  return (
    <Flex flex="1" minW="0" minH="0">
      <Flex
        direction="column"
        flexShrink="0"
        minW="0"
        minH="0"
        maxW="55%"
        style={{ width }}
      >
        <HStack
          h={titleBarHeight}
          flexShrink="0"
          gap="2"
          px="4"
          borderBottomWidth="1px"
          css={dragRegion}
        >
          <Text fontSize="sm" fontWeight="semibold">
            Issues
          </Text>
          <Text fontSize="xs" fontFamily="mono" color="fg.muted" truncate>
            {tab.repo.slug ?? tab.repo.name}
          </Text>
          <HStack ml="auto" gap="1" flexShrink="0" css={noDragRegion}>
            {slug && (
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
              repoSlug={slug}
              onAddRepo={onAddRepo}
              onOpenSettings={onOpenSettings}
            />
          </HStack>
        </HStack>

        <Box px="4" pt="2" flexShrink="0" _empty={{ display: "none" }}>
          <SetupBanner onOpenSettings={onOpenSettings} />
        </Box>

        <QueueListState
          noun="issues"
          noRepositories={false}
          addRepoPurpose="see its issues"
          onAddRepo={onAddRepo}
          repo={tab.repo}
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
            issues={issues ?? []}
            preview={selectedIssue}
            filters={tab.ui.filters}
            requestedPage={tab.ui.requestedPage}
            onSelect={selectIssue}
            onFiltersChange={(filters) => onUiChange({ filters })}
            onPageChange={(requestedPage) => onUiChange({ requestedPage })}
          />
        </QueueListState>
      </Flex>

      <ResizeHandle onPointerDown={startResize} border />

      {selectedIssue ? (
        <RepoIssuePreview
          issue={selectedIssue}
          onClose={() => onUiChange({ selectedIssueNumber: null })}
        />
      ) : (
        <Center flex="1" minW="0" p="6">
          <Text fontSize="sm" color="fg.muted">
            Pick an issue to read it here.
          </Text>
        </Center>
      )}
    </Flex>
  );
}
