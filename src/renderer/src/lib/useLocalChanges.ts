import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useDebounce } from "use-debounce";
import type {
  LocalCommit,
  LocalCommitList,
  PullRequestFile,
} from "../../../shared/types";
import { toaster } from "../components/ui/toaster";
import {
  invalidateLocalChangeQueries,
  localChangesWriteMutationKey,
} from "./localChangesMutations";
import {
  type LocalChangeArea,
  type LocalChangeSelection,
  resolveLocalChangeSelection,
  withRenameSources,
} from "./localChangesSelection";
import {
  localCommitFilesQueryOptions,
  localCommitsQueryOptions,
} from "./repoQueries";
import type { PanelBounds } from "./usePanelWidth";
import type { WorktreeSelection } from "./useWorktreeSelection";

// The working tree changes under the app constantly: always refetch on mount
// and window focus, and never persist (queryClient's doNotPersist). Shared
// with the queue's top bar, which drives the tab badge and the refresh button.
export function localChangeCountQueryOptions(repoPath: string) {
  return {
    queryKey: ["localChangeCount", repoPath],
    queryFn: () => window.api.getLocalChangeCount(repoPath),
    staleTime: 0,
    refetchOnWindowFocus: true,
  } as const;
}

export function localChangesQueryOptions(repoPath: string) {
  return {
    queryKey: ["localChanges", repoPath],
    queryFn: () => window.api.getLocalChanges(repoPath),
    staleTime: 0,
    refetchOnWindowFocus: true,
  } as const;
}

// The file-list column on the Changes tab. The tab bar sits on top of this
// column rather than across the window, so the diff beside it starts directly
// under the queue's top bar.
export const localChangesFileListPanel: PanelBounds = {
  storageKey: "localChangesFileListWidth",
  min: 220,
  max: 600,
  fallback: 300,
};

// Distinct paths across both lists — a partially staged file is one changed
// file, not two.
function changedPathCount(changes: {
  staged: PullRequestFile[];
  unstaged: PullRequestFile[];
}): number {
  const paths = new Set<string>();
  for (const file of [...changes.staged, ...changes.unstaged]) {
    paths.add(file.path);
  }
  return paths.size;
}

function matches(file: PullRequestFile, query: string): boolean {
  return (
    file.path.toLowerCase().includes(query) ||
    (file.previousPath?.toLowerCase().includes(query) ?? false)
  );
}

export interface LocalChangesState {
  // The checkout being read, and the switcher for changing it.
  worktree: WorktreeSelection;
  path: string;
  branch: string | undefined;
  // Whether the repo has more than one checkout to offer.
  switchable: boolean;

  filter: string;
  setFilter(value: string): void;
  // Whether a filter is narrowing the lists (debounced, so not just `filter`).
  filtering: boolean;

  changesPending: boolean;
  changesError: unknown;
  commitFilesPending: boolean;
  commitFilesError: unknown;

  commits: LocalCommit[];
  commitList: LocalCommitList | undefined;
  // The commit being read, or null for the uncommitted work.
  commit: LocalCommit | null;
  selectCommit(sha: string | null): void;

  staged: PullRequestFile[];
  unstaged: PullRequestFile[];
  commitFiles: PullRequestFile[];
  // Uncommitted paths, and the loaded (unfiltered) count of a commit's files.
  changedPaths: number;
  commitFileTotal: number;
  // What the Files heading counts — either mode.
  fileCount: string | null;

  stagedCount: number;
  selectFile(area: LocalChangeArea, path: string): void;
  selectedArea: LocalChangeArea | null;
  selectedPath: string | null;
  selectCommitFile(path: string): void;
  selectedCommitPath: string | null;
  // The file the diff pane shows, in whichever mode is current.
  shownFile: PullRequestFile | null;

  writesPending: boolean;
  stage(paths: string[]): void;
  unstage(paths: string[]): void;
  untracked: Set<string>;
  // The paths waiting on the discard confirmation; null closes the dialog.
  discarding: string[] | null;
  setDiscarding(paths: string[] | null): void;
}

// Everything the Changes tab reads and decides, in one place: the file-list
// column and the diff pane beside it are separate components (the tab bar caps
// the column, so they can't be one), and this is the state they share.
export function useLocalChanges(
  worktree: WorktreeSelection,
  // Whether the Changes tab is showing. Building every file's patch is the
  // expensive half of this tab, so it waits until someone is looking.
  showing: boolean,
): LocalChangesState {
  const path = worktree.path;
  const [selection, setSelection] = useState<LocalChangeSelection | null>(null);
  // null = the uncommitted work; a sha = that commit's changes, read-only.
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [commitFilePath, setCommitFilePath] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [discarding, setDiscarding] = useState<string[] | null>(null);

  const queryClient = useQueryClient();
  const writeMutationKey = localChangesWriteMutationKey(path);
  const writesPending = useIsMutating({ mutationKey: writeMutationKey }) > 0;

  const changesQuery = useQuery({
    ...localChangesQueryOptions(path),
    enabled: showing && Boolean(path),
  });
  const changes = changesQuery.data;
  const commitsQuery = useQuery({
    ...localCommitsQueryOptions(path),
    enabled: showing && Boolean(path),
  });
  const commits = useMemo(
    () => commitsQuery.data?.commits ?? [],
    [commitsQuery.data],
  );
  // A commit the list no longer holds — amended, rebased away, or on a branch
  // that has since been switched — drops back to the uncommitted work rather
  // than leaving an empty pane behind.
  const commit = commits.find((entry) => entry.sha === selectedCommit) ?? null;
  const commitFilesQuery = useQuery({
    ...localCommitFilesQueryOptions(path, commit?.sha),
    enabled: showing && Boolean(commit),
  });

  const [debouncedFilter] = useDebounce(filter, 150);
  const query = debouncedFilter.trim().toLowerCase();
  const staged = useMemo(() => {
    if (!changes) return [];
    return query
      ? changes.staged.filter((file) => matches(file, query))
      : changes.staged;
  }, [changes, query]);
  const unstaged = useMemo(() => {
    if (!changes) return [];
    return query
      ? changes.unstaged.filter((file) => matches(file, query))
      : changes.unstaged;
  }, [changes, query]);
  const commitFiles = useMemo(() => {
    const files = commitFilesQuery.data ?? [];
    return query ? files.filter((file) => matches(file, query)) : files;
  }, [commitFilesQuery.data, query]);

  // Falls back to the first visible file whenever the selection disappears —
  // staging a file moves it between the lists under the user, and the path
  // picked in one commit rarely exists in the next.
  const { file: selectedFile, area: selectedArea } =
    resolveLocalChangeSelection(selection, staged, unstaged);
  const selectedCommitFile =
    commitFiles.find((file) => file.path === commitFilePath) ??
    commitFiles[0] ??
    null;

  function reportFailure(title: string) {
    return (error: unknown) => {
      toaster.create({
        type: "error",
        title,
        description: error instanceof Error ? error.message : String(error),
      });
    };
  }

  // git is the source of truth for the index — refetch rather than patch the
  // cache, since one "add" can move a path between both lists at once.
  const settle = {
    onSettled: () => invalidateLocalChangeQueries(queryClient, path),
  };
  const stage = useMutation({
    mutationKey: writeMutationKey,
    mutationFn: (paths: string[]) => window.api.stageFiles(path, paths),
    onError: reportFailure("Couldn't stage"),
    ...settle,
  });
  const unstage = useMutation({
    mutationKey: writeMutationKey,
    mutationFn: (paths: string[]) => window.api.unstageFiles(path, paths),
    onError: reportFailure("Couldn't unstage"),
    ...settle,
  });

  const untracked = useMemo(() => new Set(changes?.untracked ?? []), [changes]);

  const changedPaths = changes ? changedPathCount(changes) : 0;
  const shownPaths = new Set([...staged, ...unstaged].map((file) => file.path))
    .size;
  const commitFileTotal = commitFilesQuery.data?.length ?? 0;
  const changeCount = !changes
    ? null
    : query
      ? `${shownPaths}/${changedPaths}`
      : `${changedPaths}`;
  const commitFileCount = !commitFilesQuery.data
    ? null
    : query
      ? `${commitFiles.length}/${commitFileTotal}`
      : `${commitFileTotal}`;

  return {
    worktree,
    path,
    // Either local query names the checkout's branch; whichever has loaded
    // does. Null (a detached HEAD) reads the same as unknown here — there is
    // no branch name to show either way.
    branch: changes?.branch ?? commitsQuery.data?.branch ?? undefined,
    switchable: (worktree.worktrees?.length ?? 0) > 1,

    filter,
    setFilter,
    filtering: Boolean(query),

    changesPending: changesQuery.isPending,
    changesError: changesQuery.isError ? changesQuery.error : null,
    commitFilesPending: commitFilesQuery.isPending,
    commitFilesError: commitFilesQuery.isError ? commitFilesQuery.error : null,

    commits,
    commitList: commitsQuery.data,
    commit,
    selectCommit: setSelectedCommit,

    staged,
    unstaged,
    commitFiles,
    changedPaths,
    commitFileTotal,
    fileCount: commit ? commitFileCount : changeCount,

    stagedCount: changes?.staged.length ?? 0,
    selectFile: (area, filePath) => setSelection({ area, path: filePath }),
    selectedArea: commit ? null : selectedArea,
    selectedPath: selectedFile?.path ?? null,
    selectCommitFile: setCommitFilePath,
    selectedCommitPath: selectedCommitFile?.path ?? null,
    shownFile: commit ? selectedCommitFile : selectedFile,

    writesPending,
    stage: (paths) => stage.mutate(paths),
    unstage: (paths) => unstage.mutate(withRenameSources(staged, paths)),
    untracked,
    discarding,
    setDiscarding,
  };
}
