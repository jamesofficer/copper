import {
  Box,
  Center,
  Flex,
  Heading,
  HStack,
  Input,
  InputGroup,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LuSearch } from "react-icons/lu";
import { useDebounce } from "use-debounce";
import { scrollbar } from "../lib/scrollbar";
import { usePanelWidth } from "../lib/usePanelWidth";
import DiffView from "./DiffView";
import FileList from "./FileList";

interface Props {
  // The checkout to read — the registered repo path, or one of its worktrees.
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

// Browse-only view of the checkout's uncommitted changes (staged, unstaged,
// and untracked) — the Changes-tab layout without the PR-only affordances
// (commenting, viewed state, context expansion).
export default function LocalChangesView({ path }: Props) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const { width: sidebarWidth, startResize: startSidebarResize } =
    usePanelWidth({
      storageKey: "localChangesFileListWidth",
      min: 220,
      max: 600,
      fallback: 300,
      handle: "right",
    });

  const changesQuery = useQuery(localChangesQueryOptions(path));
  const files = changesQuery.data?.files;

  const [debouncedFilter] = useDebounce(filter, 150);
  const query = debouncedFilter.trim().toLowerCase();
  const visibleFiles = useMemo(() => {
    if (!files || !query) return files;
    return files.filter(
      (file) =>
        file.path.toLowerCase().includes(query) ||
        file.previousPath?.toLowerCase().includes(query),
    );
  }, [files, query]);
  const selectedFile =
    visibleFiles?.find((file) => file.path === selectedPath) ??
    visibleFiles?.[0] ??
    null;

  const fileCount = files
    ? query
      ? `${visibleFiles?.length ?? 0}/${files.length}`
      : `${files.length}`
    : null;

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
            ) : visibleFiles && visibleFiles.length > 0 ? (
              <FileList
                files={visibleFiles}
                selectedPath={selectedFile?.path ?? null}
                onSelect={setSelectedPath}
              />
            ) : (
              <Text fontSize="sm" color="fg.muted" px="1">
                {files && files.length > 0
                  ? "No files match your filter."
                  : "No uncommitted changes."}
              </Text>
            )}
          </Box>
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
          <DiffView file={selectedFile} />
        ) : (
          <Center h="full" p="4">
            <Text color="fg.muted" fontSize="sm">
              {changesQuery.isPending
                ? "Reading local changes…"
                : files && files.length === 0
                  ? "The working tree is clean — nothing to review."
                  : "Select a file to view its diff."}
            </Text>
          </Center>
        )}
      </Box>
    </Flex>
  );
}
