import {
  Box,
  Button,
  Center,
  Flex,
  HStack,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LuCheck, LuFileCode, LuFileDiff } from "react-icons/lu";
import type { PullRequestFile } from "../../../shared/types";
import { statusMeta } from "../lib/fileStatus";
import { scrollbar } from "../lib/scrollbar";
import DiffLines, {
  type DiffCommenting,
  type DiffExpansion,
} from "./DiffLines";
import FileView from "./FileView";

interface Props {
  file: PullRequestFile;
  commenting?: DiffCommenting;
  // Undefined hides the Viewed button (commit-by-commit views).
  viewed?: boolean;
  onToggleViewed?(viewed: boolean): void;
  // Where to read the full file from — enables expand-hidden-lines,
  // whole-file syntax highlighting, and the full-file view.
  fileContext?: { repo: string; sha: string };
}

export default function DiffView({
  file,
  commenting,
  viewed,
  onToggleViewed,
  fileContext,
}: Props) {
  const meta = statusMeta[file.status];
  const [showFullFile, setShowFullFile] = useState(false);

  // Deleted files don't exist at the diff's commit.
  const canReadFile = Boolean(fileContext) && file.status !== "deleted";

  // Fetched eagerly (not just on demand): DiffLines uses the full file to fix
  // fragment-highlighting artifacts even when nothing is expanded. Content at
  // a fixed sha never changes, hence the infinite staleTime.
  const fileQuery = useQuery({
    queryKey: ["fileAtCommit", fileContext?.repo, fileContext?.sha, file.path],
    queryFn: () =>
      window.api.getFileAtCommit(
        fileContext?.repo ?? "",
        fileContext?.sha ?? "",
        file.path,
      ),
    enabled: canReadFile,
    staleTime: Number.POSITIVE_INFINITY,
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
    <Flex direction="column" h="full" minH="0">
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
        <Text as="span" fontFamily="mono" fontSize="xs" wordBreak="break-all">
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
          {viewed !== undefined && onToggleViewed && (
            <Button
              size="2xs"
              variant="outline"
              colorPalette={viewed ? "green" : undefined}
              color={viewed ? undefined : "fg.muted"}
              onClick={() => onToggleViewed(!viewed)}
            >
              {viewed && <LuCheck />} Viewed
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
              The file couldn’t be read from the local repo clone.
            </Text>
          </Center>
        ) : (
          <Box flex="1" minH="0" overflow="auto" css={scrollbar}>
            <FileView path={file.path} text={fullFile} />
          </Box>
        )
      ) : file.patch ? (
        <Box flex="1" minH="0" overflow="auto" css={scrollbar}>
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
    </Flex>
  );
}
