import { Flex } from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Repository } from "../../../../shared/types";
import LocalChangesColumn from "../../components/LocalChangesColumn";
import LocalChangesPane from "../../components/LocalChangesPane";
import ResizeHandle from "../../components/ResizeHandle";
import { invalidateLocalChangeQueries } from "../../lib/localChangesMutations";
import { worktreesQueryOptions } from "../../lib/repoQueries";
import { localChangesTitle } from "../../lib/tabs/tabLabel";
import type {
  LocalChangesTab,
  OpenLocalChangesArgs,
} from "../../lib/tabs/tabs";
import {
  localChangesFileListPanel,
  useLocalChanges,
} from "../../lib/useLocalChanges";
import { usePanelWidth } from "../../lib/usePanelWidth";
import type { WorktreeSelection } from "../../lib/worktreeSelection";

interface Props {
  tab: LocalChangesTab;
  repo: Repository | null;
  onOpenWorktree(args: OpenLocalChangesArgs): void;
  onAddRepo(): void;
  onOpenSettings(): void;
}

// One checkout's local changes. A worktree switch opens another tab instead of
// changing this tab's identity.
export default function LocalChanges({
  tab,
  repo,
  onOpenWorktree,
  onAddRepo,
  onOpenSettings,
}: Props) {
  const queryClient = useQueryClient();
  const worktreesQuery = useQuery(worktreesQueryOptions(tab.repoPath));
  const repoName = repo?.name ?? tab.title.split(" (")[0];

  function selectWorktree(path: string) {
    const worktree = worktreesQuery.data?.find((entry) => entry.path === path);
    if (!worktree) return;
    onOpenWorktree({
      repoPath: tab.repoPath,
      worktreePath: path,
      title: localChangesTitle(repoName, worktree),
    });
  }

  const worktree: WorktreeSelection = {
    worktrees: worktreesQuery.data,
    path: tab.worktreePath,
    select: selectWorktree,
    refetch: () => void worktreesQuery.refetch(),
  };
  const state = useLocalChanges(worktree, true);
  const { width, startResize } = usePanelWidth({
    ...localChangesFileListPanel,
    handle: "right",
  });

  function refresh() {
    void worktreesQuery.refetch();
    void invalidateLocalChangeQueries(queryClient, tab.worktreePath);
    void queryClient.invalidateQueries({
      queryKey: ["localCommits", tab.worktreePath],
    });
  }

  return (
    <Flex flex="1" minW="0" minH="0">
      <Flex
        direction="column"
        minH="0"
        minW="0"
        flexShrink="0"
        style={{ width }}
      >
        <LocalChangesColumn
          state={state}
          repoSlug={repo?.slug ?? undefined}
          refreshing={state.changesRefreshing || worktreesQuery.isFetching}
          onRefresh={refresh}
          onAddRepo={onAddRepo}
          onOpenSettings={onOpenSettings}
        />
      </Flex>
      <ResizeHandle onPointerDown={startResize} border />
      <LocalChangesPane state={state} />
    </Flex>
  );
}
