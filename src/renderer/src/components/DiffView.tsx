import {
  Box,
  Button,
  Center,
  Flex,
  HStack,
  IconButton,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LuArrowRight,
  LuCheck,
  LuChevronLeft,
  LuChevronRight,
  LuFileCode,
  LuFileDiff,
  LuSquare,
} from "react-icons/lu";
import type { LocalFileSource, PullRequestFile } from "../../../shared/types";
import { statusMeta } from "../lib/fileStatus";
import { scrollbar } from "../lib/scrollbar";
import { syntaxBackground } from "../lib/syntaxColors";
import { useSyntaxThemes } from "../lib/syntaxTheme";
import DiffLines, {
  type DiffCommenting,
  type DiffExpansion,
} from "./DiffLines";
import DiffViewModeSelect from "./DiffViewModeSelect";
import FileView from "./FileView";

export type DiffFileContext =
  | { kind: "commit"; repo: string; sha: string }
  | { kind: "local"; repoPath: string; source: LocalFileSource };

interface Props {
  file: PullRequestFile;
  commenting?: DiffCommenting;
  // Undefined hides the Viewed button (commit-by-commit views).
  viewed?: boolean;
  viewedUpdating?: boolean;
  onToggleViewed?(viewed: boolean): void;
  hasPreviousFile?: boolean;
  hasNextFile?: boolean;
  onPreviousFile?(): void;
  onNextFile?(): void;
  reviewProgress?: { viewed: number; total: number };
  onMarkViewedAndNext?(): void;
  markViewedLabel?: string;
  markViewedDisabled?: boolean;
  // Where to read the full file from. This enables hidden-line expansion,
  // whole-file syntax highlighting, and the full-file view.
  fileContext?: DiffFileContext;
}

export default function DiffView({
  file,
  commenting,
  viewed,
  viewedUpdating,
  onToggleViewed,
  hasPreviousFile,
  hasNextFile,
  onPreviousFile,
  onNextFile,
  reviewProgress,
  onMarkViewedAndNext,
  markViewedLabel,
  markViewedDisabled,
  fileContext,
}: Props) {
  const meta = statusMeta[file.status];
  const [showFullFile, setShowFullFile] = useState(false);
  // The scroll pane shares the theme's background so the area past the last
  // row matches the rows instead of snapping back to the app surface.
  const paneBackground = syntaxBackground(useSyntaxThemes());

  // Deleted files don't exist at the diff's commit.
  const canReadFile = Boolean(fileContext) && file.status !== "deleted";

  // DiffLines uses the full file to correct syntax highlighting. The read
  // starts before the user expands a section. A commit cannot change. The
  // working tree and index can change, so those queries remain stale.
  const localSource = fileContext?.kind === "local" ? fileContext.source : null;
  const mutableLocalFile =
    localSource?.kind === "working" || localSource?.kind === "index";
  const fileQuery = useQuery({
    queryKey:
      fileContext?.kind === "commit"
        ? ["fileAtCommit", fileContext.repo, fileContext.sha, file.path]
        : [
            "localFile",
            fileContext?.repoPath,
            localSource?.kind,
            localSource?.kind === "commit" ? localSource.sha : null,
            file.path,
          ],
    queryFn: () => {
      if (!fileContext) return Promise.resolve(null);
      return fileContext.kind === "commit"
        ? window.api.getFileAtCommit(
            fileContext.repo,
            fileContext.sha,
            file.path,
          )
        : window.api.getLocalFile(
            fileContext.repoPath,
            fileContext.source,
            file.path,
          );
    },
    enabled: canReadFile,
    staleTime: mutableLocalFile ? 0 : Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: mutableLocalFile,
  });
  const fullFile = fileQuery.data ?? null;

  // This component instance is reused when the user switches files.
  // biome-ignore lint/correctness/useExhaustiveDependencies: file.path is the reset trigger
  useEffect(() => {
    setShowFullFile(false);
  }, [file.path]);

  // Stable callback so the memoized DiffLines only re-renders when the file
  // content itself changes; a re-request only matters after a failed read.
  const latestFile = useRef(fullFile);
  latestFile.current = fullFile;
  const refetch = fileQuery.refetch;
  const requestFullFile = useCallback(() => {
    if (latestFile.current === null) void refetch();
  }, [refetch]);

  const expansion = useMemo<DiffExpansion | undefined>(
    () => (canReadFile ? { fullFile, requestFullFile } : undefined),
    [canReadFile, fullFile, requestFullFile],
  );

  return (
    <Flex direction="column" h="full" minH="0" position="relative">
      <HStack
        px="4"
        py="2"
        gap="2"
        bg="bg.subtle"
        borderBottomWidth="1px"
        flexShrink="0"
      >
        <Text
          as="span"
          fontFamily="mono"
          fontSize="xs"
          fontWeight="bold"
          color={meta.color}
          flexShrink="0"
        >
          {meta.label}
        </Text>
        <Text
          as="span"
          fontFamily="mono"
          fontSize="xs"
          truncate
          minW="0"
          flex="1"
        >
          {file.path}
        </Text>
        {file.previousPath && (
          <Text
            as="span"
            fontFamily="mono"
            fontSize="xs"
            color="fg.muted"
            wordBreak="break-all"
          >
            (from {file.previousPath})
          </Text>
        )}
        <HStack gap="1.5" fontFamily="mono" fontSize="2xs">
          <Text as="span" color="green.fg">
            +{file.additions}
          </Text>
          <Text as="span" color="red.fg">
            −{file.deletions}
          </Text>
        </HStack>

        <HStack gap="2" flexShrink="0" ml="auto">
          {onPreviousFile && onNextFile && (
            <HStack gap="0" borderWidth="1px" rounded="md">
              <IconButton
                aria-label="Previous file"
                title="Previous file"
                size="xs"
                variant="ghost"
                color="fg.muted"
                disabled={!hasPreviousFile}
                onClick={onPreviousFile}
              >
                <LuChevronLeft />
              </IconButton>
              <IconButton
                aria-label="Next file"
                title="Next file"
                size="xs"
                variant="ghost"
                color="fg.muted"
                disabled={!hasNextFile}
                onClick={onNextFile}
              >
                <LuChevronRight />
              </IconButton>
            </HStack>
          )}
          {viewed !== undefined && onToggleViewed && (
            <Button
              size="xs"
              h="34px"
              variant="outline"
              colorPalette={viewed ? "green" : undefined}
              color={viewed ? undefined : "fg.muted"}
              disabled={viewedUpdating}
              onClick={() => onToggleViewed(!viewed)}
            >
              {viewed ? <LuCheck /> : <LuSquare />} Viewed
            </Button>
          )}

          {canReadFile && (
            <Button
              size="2xs"
              variant="ghost"
              color="fg.muted"
              onClick={() => setShowFullFile(!showFullFile)}
            >
              {showFullFile ? <LuFileDiff /> : <LuFileCode />}
              {showFullFile ? "View diff" : "View file"}
            </Button>
          )}
          <DiffViewModeSelect />
        </HStack>
      </HStack>

      {showFullFile ? (
        fileQuery.isPending ? (
          <Center flex="1" p="8">
            <Spinner size="sm" />
          </Center>
        ) : fullFile === null ? (
          <Center flex="1" p="8">
            <Text color="fg.muted" fontSize="sm" textAlign="center">
              The full file couldn’t be read.
            </Text>
          </Center>
        ) : (
          <Box
            flex="1"
            minH="0"
            overflow="auto"
            css={[scrollbar, paneBackground]}
          >
            <FileView path={file.path} text={fullFile} />
          </Box>
        )
      ) : file.patch ? (
        <Box
          flex="1"
          minH="0"
          overflow="auto"
          css={[scrollbar, paneBackground]}
        >
          <DiffLines
            file={file}
            commenting={commenting}
            expansion={expansion}
          />
        </Box>
      ) : (
        <Center flex="1" p="8">
          <Text color="fg.muted" fontSize="sm" textAlign="center">
            {file.status === "renamed"
              ? "File renamed with no content changes."
              : "No text diff available — this file is binary or too large to show."}
          </Text>
        </Center>
      )}
      {reviewProgress && onMarkViewedAndNext && (
        <HStack
          position="absolute"
          right="6"
          bottom="6"
          gap="2"
          rounded="md"
          borderWidth="1px"
          bg="bg.panel"
          boxShadow="md"
          px="2"
          py="1.5"
        >
          <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap">
            {reviewProgress.viewed} / {reviewProgress.total} viewed
          </Text>
          <Button
            size="xs"
            disabled={markViewedDisabled}
            onClick={onMarkViewedAndNext}
          >
            {markViewedLabel ?? "Mark viewed & next"} <LuArrowRight />
          </Button>
        </HStack>
      )}
    </Flex>
  );
}
