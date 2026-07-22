import {
  Box,
  Center,
  Collapsible,
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
import { LuChevronRight, LuSearch } from "react-icons/lu";
import { useDebounce } from "use-debounce";
import type { PullRequest } from "../../../shared/types";
import { buildReviewThreads } from "../lib/reviewComments";
import { scrollbar } from "../lib/scrollbar";
import { usePanelWidth } from "../lib/usePanelWidth";
import CommitList from "./CommitList";
import DiffView from "./DiffView";
import FileList from "./FileList";

interface Props {
  pr: PullRequest;
}

export default function ChangesView({ pr }: Props) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  // null = the full changelist (base...head); a sha = just that commit.
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const { width: sidebarWidth, startResize: startSidebarResize } =
    usePanelWidth({
      storageKey: "changesFileListWidth",
      min: 220,
      max: 600,
      fallback: 300,
      handle: "right",
    });

  const commitsQuery = useQuery({
    queryKey: ["pullRequestCommits", pr.repo, pr.number],
    queryFn: () => window.api.listPullRequestCommits(pr.repo, pr.number),
  });
  const commits = commitsQuery.data;

  const filesQuery = useQuery({
    queryKey: selectedCommit
      ? ["commitFiles", pr.repo, selectedCommit]
      : ["pullRequestFiles", pr.repo, pr.number],
    queryFn: () =>
      selectedCommit
        ? window.api.listCommitFiles(pr.repo, selectedCommit)
        : window.api.listPullRequestFiles(pr.repo, pr.number),
  });
  const files = filesQuery.data;

  // The input is live but the filtering (and everything derived from it)
  // waits out the typing burst.
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

  // Same key as the Overview tab's query — needed for the full head SHA
  // (the summary prop's headSha is truncated for display).
  const detailQuery = useQuery({
    queryKey: ["pullRequest", pr.repo, pr.number],
    queryFn: () => window.api.getPullRequest(pr.repo, pr.number),
  });

  const reviewCommentsQuery = useQuery({
    queryKey: ["reviewComments", pr.repo, pr.number],
    queryFn: () => window.api.listReviewComments(pr.repo, pr.number),
  });
  const threadsByPath = useMemo(
    () => buildReviewThreads(reviewCommentsQuery.data ?? []),
    [reviewCommentsQuery.data],
  );

  // Inline commenting only works against the full changelist — a single
  // commit's diff numbers lines differently than the PR diff GitHub anchors
  // comments to. Memoized so DiffLines' memo sees a stable prop and unrelated
  // re-renders (filter keystrokes) skip the diff entirely.
  const headSha = detailQuery.data?.headSha;
  const commenting = useMemo(
    () =>
      selectedCommit === null && headSha && selectedFile
        ? {
            repo: pr.repo,
            prNumber: pr.number,
            commitId: headSha,
            threads: threadsByPath.get(selectedFile.path) ?? [],
          }
        : undefined,
    [selectedCommit, headSha, selectedFile, threadsByPath, pr.repo, pr.number],
  );

  return (
    <Flex h="full" minH="0">
      <Flex flexShrink="0" minH="0" style={{ width: sidebarWidth }}>
        <Flex direction="column" flex="1" minW="0" borderRightWidth="1px">
          {commits && commits.length > 1 && (
            <Collapsible.Root flexShrink="0">
              <Collapsible.Trigger w="full" cursor="pointer">
                <HStack gap="1.5" px="4" py="3" color="fg.muted">
                  <Heading
                    size="xs"
                    color="fg.muted"
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    Commits ({commits.length})
                  </Heading>
                  {selectedCommit && (
                    <Text fontFamily="mono" fontSize="2xs">
                      · {selectedCommit.slice(0, 7)}
                    </Text>
                  )}
                  <Collapsible.Indicator
                    ml="auto"
                    transition="transform 0.2s"
                    _open={{ transform: "rotate(90deg)" }}
                  >
                    <LuChevronRight size="14" />
                  </Collapsible.Indicator>
                </HStack>
              </Collapsible.Trigger>
              <Collapsible.Content>
                <Box
                  maxH="180px"
                  overflowY="auto"
                  px="3"
                  pb="3"
                  css={scrollbar}
                >
                  <CommitList
                    commits={commits}
                    selectedSha={selectedCommit}
                    onSelect={setSelectedCommit}
                  />
                </Box>
              </Collapsible.Content>
            </Collapsible.Root>
          )}

          <Heading
            size="xs"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="wider"
            px="4"
            py="3"
            flexShrink="0"
            borderTopWidth={commits && commits.length > 1 ? "1px" : "0"}
          >
            Files{fileCount ? ` (${fileCount})` : ""}
          </Heading>
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
            {filesQuery.isPending ? (
              <HStack color="fg.muted" px="1">
                <Spinner size="sm" />
                <Text fontSize="sm">Loading changed files…</Text>
              </HStack>
            ) : filesQuery.isError ? (
              <Text fontSize="sm" color="fg.error" px="1">
                {filesQuery.error instanceof Error
                  ? filesQuery.error.message
                  : "Couldn't load changed files."}
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
                  : "No changed files."}
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
          <DiffView file={selectedFile} commenting={commenting} />
        ) : (
          <Center h="full" p="4">
            <Text color="fg.muted" fontSize="sm">
              {filesQuery.isPending
                ? "Loading diff…"
                : "Select a file to view its diff."}
            </Text>
          </Center>
        )}
      </Box>
    </Flex>
  );
}
