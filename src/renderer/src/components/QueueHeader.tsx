import { HStack, IconButton, Text } from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LuRefreshCw } from "react-icons/lu";
import type { PullRequest, Repository } from "../../../shared/types";
import { pullRequestsQueryOptions } from "../lib/repoQueries";
import { dragRegion, noDragRegion, titleBarHeight } from "../lib/titleBar";
import NewPullRequestDialog from "./NewPullRequestDialog";
import QueueActionsMenu from "./QueueActionsMenu";
import ShowSidebarButton from "./ShowSidebarButton";

interface Props {
  repo: Repository | null;
  onAddRepo(): void;
  onOpenSettings(): void;
  onOpenPullRequest(pr: PullRequest): void;
}

// The pull request queue's toolbar. It reads the same query as the list below,
// so refresh state does not need to pass through the screen.
export default function QueueHeader({
  repo,
  onAddRepo,
  onOpenSettings,
  onOpenPullRequest,
}: Props) {
  const queryClient = useQueryClient();
  const slug = repo?.slug ?? undefined;
  const prsQuery = useQuery(pullRequestsQueryOptions(slug));

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
      pl="4"
      pr="3"
      gap="2"
      borderBottomWidth="1px"
      css={dragRegion}
    >
      <HStack css={noDragRegion}>
        <ShowSidebarButton />
      </HStack>
      <Text fontSize="sm" fontWeight="semibold" truncate>
        Pull requests
      </Text>
      <HStack ml="auto" gap="1" flexShrink="0" css={noDragRegion}>
        {slug && (
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
