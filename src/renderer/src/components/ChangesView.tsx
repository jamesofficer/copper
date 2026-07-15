import {
  Box,
  Center,
  Collapsible,
  Flex,
  Heading,
  HStack,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LuChevronRight } from "react-icons/lu";
import type { PullRequest } from "../../../shared/types";
import { scrollbar } from "../lib/scrollbar";
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
  const selectedFile =
    files?.find((file) => file.path === selectedPath) ?? files?.[0] ?? null;

  return (
    <Flex h="full" minH="0">
      <Flex
        direction="column"
        w="300px"
        flexShrink="0"
        borderRightWidth="1px"
        minH="0"
      >
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
              <Box maxH="180px" overflowY="auto" px="3" pb="3" css={scrollbar}>
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
          Files{files ? ` (${files.length})` : ""}
        </Heading>
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
          ) : files && files.length > 0 ? (
            <FileList
              files={files}
              selectedPath={selectedFile?.path ?? null}
              onSelect={setSelectedPath}
            />
          ) : (
            <Text fontSize="sm" color="fg.muted" px="1">
              No changed files.
            </Text>
          )}
        </Box>
      </Flex>

      <Box flex="1" minH="0" minW="0">
        {selectedFile ? (
          <DiffView file={selectedFile} />
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
