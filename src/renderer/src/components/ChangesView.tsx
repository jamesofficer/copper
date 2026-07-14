import {
  Box,
  Center,
  Flex,
  Heading,
  HStack,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { PullRequest } from "../../../shared/types";
import { scrollbar } from "../lib/scrollbar";
import DiffView from "./DiffView";
import FileList from "./FileList";

interface Props {
  pr: PullRequest;
}

export default function ChangesView({ pr }: Props) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const filesQuery = useQuery({
    queryKey: ["pullRequestFiles", pr.repo, pr.number],
    queryFn: () => window.api.listPullRequestFiles(pr.repo, pr.number),
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
        <Heading
          size="xs"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
          px="4"
          py="3"
          flexShrink="0"
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
