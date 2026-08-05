import {
  Box,
  Button,
  Center,
  Flex,
  Heading,
  HStack,
  Input,
  InputGroup,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LuMinus, LuPlus, LuSearch, LuUndo2 } from "react-icons/lu";
import { useDebounce } from "use-debounce";
import type { PullRequestFile } from "../../../shared/types";
import { scrollbar } from "../lib/scrollbar";
import { usePanelWidth } from "../lib/usePanelWidth";
import CommitComposer from "./CommitComposer";
import DiffView from "./DiffView";
import DiscardChangesDialog from "./DiscardChangesDialog";
import FileList, { type RowAction } from "./FileList";
import { toaster } from "./ui/toaster";

interface Props {
  // The checkout to read — the registered repo path, or one of its worktrees.
  path: string;
}

// Which of the two lists a selected file came from. A partially staged path
// appears in both with different diffs, so the path alone can't identify it.
type Area = "staged" | "unstaged";

interface Selection {
  area: Area;
  path: string;
}

// The working tree changes under the app constantly: always refetch on mount
// and window focus, and never persist (queryClient's doNotPersist). Shared
// with the home screen's top bar, which shows the branch and refresh button.
export function localChangesQueryOptions(repoPath: string) {
  return {
    queryKey: ["localChanges", repoPath],
    queryFn: () => window.api.getLocalChanges(repoPath),
    staleTime: 0,
    refetchOnWindowFocus: true,
  } as const;
}

// Distinct paths across both lists — a partially staged file is one changed
// file, not two.
export function changedPathCount(changes: {
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

// The checkout's uncommitted changes, split into the index and the working
// tree: browse the diffs, move files between the two, and commit what is
// staged. The PR-only affordances (commenting, viewed state, context
// expansion) stay out.
export default function LocalChangesView({ path }: Props) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [filter, setFilter] = useState("");
  // The paths waiting on the discard confirmation; null closes the dialog.
  const [discarding, setDiscarding] = useState<string[] | null>(null);
  const queryClient = useQueryClient();
  const { width: sidebarWidth, startResize: startSidebarResize } =
    usePanelWidth({
      storageKey: "localChangesFileListWidth",
      min: 220,
      max: 600,
      fallback: 300,
      handle: "right",
    });

  const changesQuery = useQuery(localChangesQueryOptions(path));
  const changes = changesQuery.data;

  const [debouncedFilter] = useDebounce(filter, 150);
  const query = debouncedFilter.trim().toLowerCase();
  const staged = useMemo(() => {
    if (!changes) return [];
    return query
      ? changes.staged.filter((f) => matches(f, query))
      : changes.staged;
  }, [changes, query]);
  const unstaged = useMemo(() => {
    if (!changes) return [];
    return query
      ? changes.unstaged.filter((f) => matches(f, query))
      : changes.unstaged;
  }, [changes, query]);

  // Falls back to the first visible file whenever the selection disappears —
  // staging a file moves it between the lists under the user.
  const selectedFile =
    (selection?.area === "staged"
      ? staged.find((file) => file.path === selection.path)
      : selection
        ? unstaged.find((file) => file.path === selection.path)
        : undefined) ??
    unstaged[0] ??
    staged[0] ??
    null;
  const selectedArea: Area | null = !selectedFile
    ? null
    : selection && selectedFile.path === selection.path
      ? selection.area
      : unstaged.includes(selectedFile)
        ? "unstaged"
        : "staged";

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
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["localChanges", path] }),
  };
  const stage = useMutation({
    mutationFn: (paths: string[]) => window.api.stageFiles(path, paths),
    onError: reportFailure("Couldn't stage"),
    ...settle,
  });
  const unstage = useMutation({
    mutationFn: (paths: string[]) => window.api.unstageFiles(path, paths),
    onError: reportFailure("Couldn't unstage"),
    ...settle,
  });

  const untrackedPaths = useMemo(
    () => new Set(changes?.untracked ?? []),
    [changes],
  );
  const total = changes ? changedPathCount(changes) : 0;
  const shown = new Set([...staged, ...unstaged].map((file) => file.path)).size;
  const fileCount = !changes ? null : query ? `${shown}/${total}` : `${total}`;

  return (
    <Flex h="full" minH="0">
      <Flex flexShrink="0" minH="0" style={{ width: sidebarWidth }}>
        <Flex direction="column" flex="1" minW="0" borderRightWidth="1px">
          <HStack px="4" py="3" flexShrink="0">
            <Heading
              size="xs"
              color="fg.muted"
              textTransform="uppercase"
              letterSpacing="wider"
            >
              Files{fileCount ? ` (${fileCount})` : ""}
            </Heading>
          </HStack>
          <Box px="3" pb="2" flexShrink="0">
            <InputGroup startElement={<LuSearch size={12} />}>
              <Input
                size="xs"
                placeholder="Filter files"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setFilter("");
                }}
              />
            </InputGroup>
          </Box>
          <Box flex="1" overflowY="auto" px="3" pb="3" css={scrollbar}>
            {changesQuery.isPending ? (
              <HStack color="fg.muted" px="1">
                <Spinner size="sm" />
                <Text fontSize="sm">Reading local changes…</Text>
              </HStack>
            ) : changesQuery.isError ? (
              <Text fontSize="sm" color="fg.error" px="1">
                {changesQuery.error instanceof Error
                  ? changesQuery.error.message
                  : "Couldn't read local changes."}
              </Text>
            ) : staged.length === 0 && unstaged.length === 0 ? (
              <Text fontSize="sm" color="fg.muted" px="1">
                {total > 0
                  ? "No files match your filter."
                  : "No uncommitted changes."}
              </Text>
            ) : (
              <Stack gap="4">
                <FileGroup
                  title="Staged"
                  files={staged}
                  selectedPath={
                    selectedArea === "staged"
                      ? (selectedFile?.path ?? null)
                      : null
                  }
                  onSelect={(file) =>
                    setSelection({ area: "staged", path: file })
                  }
                  bulkLabel="Unstage all"
                  onBulk={(paths) => unstage.mutate(paths)}
                  busy={unstage.isPending}
                  actions={[
                    {
                      icon: <LuMinus />,
                      label: "Unstage",
                      onRun: (path) => unstage.mutate([path]),
                    },
                  ]}
                />
                <FileGroup
                  title="Changes"
                  files={unstaged}
                  selectedPath={
                    selectedArea === "unstaged"
                      ? (selectedFile?.path ?? null)
                      : null
                  }
                  onSelect={(file) =>
                    setSelection({ area: "unstaged", path: file })
                  }
                  bulkLabel="Stage all"
                  onBulk={(paths) => stage.mutate(paths)}
                  busy={stage.isPending}
                  actions={[
                    {
                      icon: <LuUndo2 />,
                      label: "Discard",
                      colorPalette: "red",
                      onRun: (path) => setDiscarding([path]),
                    },
                    {
                      icon: <LuPlus />,
                      label: "Stage",
                      onRun: (path) => stage.mutate([path]),
                    },
                  ]}
                />
              </Stack>
            )}
          </Box>
          <CommitComposer
            path={path}
            stagedCount={changes?.staged.length ?? 0}
          />
          <DiscardChangesDialog
            repoPath={path}
            paths={discarding}
            untracked={untrackedPaths}
            onClose={() => setDiscarding(null)}
          />
        </Flex>
        <Box
          w="1"
          flexShrink="0"
          cursor="col-resize"
          onPointerDown={startSidebarResize}
          _hover={{ bg: "border.emphasized" }}
          transition="background 0.15s"
        />
      </Flex>

      <Box flex="1" minH="0" minW="0">
        {selectedFile ? (
          <DiffView
            key={`${selectedArea}:${selectedFile.path}`}
            file={selectedFile}
          />
        ) : (
          <Center h="full" p="4">
            <Text color="fg.muted" fontSize="sm">
              {changesQuery.isPending
                ? "Reading local changes…"
                : total === 0
                  ? "The working tree is clean — nothing to review."
                  : "Select a file to view its diff."}
            </Text>
          </Center>
        )}
      </Box>
    </Flex>
  );
}

interface GroupProps {
  title: string;
  files: PullRequestFile[];
  selectedPath: string | null;
  onSelect(path: string): void;
  bulkLabel: string;
  onBulk(paths: string[]): void;
  actions: RowAction[];
  busy: boolean;
}

// One side of the index, with its bulk action in the header. Empty groups
// render nothing — an empty "Staged" heading is noise.
function FileGroup({
  title,
  files,
  selectedPath,
  onSelect,
  bulkLabel,
  onBulk,
  actions,
  busy,
}: GroupProps) {
  if (files.length === 0) return null;

  return (
    <Stack gap="1">
      <HStack px="1" justify="space-between" className="group">
        <Heading
          size="xs"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
        >
          {title} ({files.length})
        </Heading>
        <Button
          size="2xs"
          variant="ghost"
          disabled={busy}
          onClick={() => onBulk(files.map((file) => file.path))}
        >
          {bulkLabel}
        </Button>
      </HStack>
      <FileList
        files={files}
        selectedPath={selectedPath}
        onSelect={onSelect}
        rowActions={actions}
      />
    </Stack>
  );
}
