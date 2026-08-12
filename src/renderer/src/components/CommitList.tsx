import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import type { PullRequestCommit } from "../../../shared/types";
import RelativeTime from "./RelativeTime";

interface Props {
  commits: PullRequestCommit[];
  selectedSha: string | null;
  onSelect(sha: string | null): void;
  // The row that clears the selection, for a list where "everything at once"
  // is a real answer. Null on the Commits tab, where a commit is the only
  // thing there is to show.
  allLabel?: string | null;
  // The API's oldest-first order needs reversing; git log is already newest
  // first.
  newestFirst?: boolean;
}

interface RowProps {
  selected: boolean;
  onClick(): void;
  title?: string;
  children: React.ReactNode;
}

function CommitRow({ selected, onClick, title, children }: RowProps) {
  return (
    <Box
      as="button"
      onClick={onClick}
      textAlign="left"
      rounded="md"
      px="2"
      py="1.5"
      w="full"
      title={title}
      bg={selected ? "bg.emphasized" : "transparent"}
      _hover={{ bg: selected ? "bg.emphasized" : "bg.subtle" }}
    >
      {children}
    </Box>
  );
}

export default function CommitList({
  commits,
  selectedSha,
  onSelect,
  allLabel = "All changes",
  newestFirst = false,
}: Props) {
  const ordered = newestFirst ? commits : [...commits].reverse();
  return (
    <Stack gap="0.5">
      {allLabel !== null && (
        <CommitRow
          selected={selectedSha === null}
          onClick={() => onSelect(null)}
        >
          <Text fontSize="xs" fontWeight="medium">
            {allLabel}
          </Text>
        </CommitRow>
      )}
      {ordered.map((commit) => (
        <CommitRow
          key={commit.sha}
          selected={commit.sha === selectedSha}
          onClick={() => onSelect(commit.sha)}
          title={`${commit.subject} — ${commit.author}`}
        >
          <HStack gap="2" minW="0">
            <Text
              as="span"
              fontFamily="mono"
              fontSize="2xs"
              color="fg.muted"
              flexShrink="0"
            >
              {commit.sha.slice(0, 7)}
            </Text>
            <Text as="span" fontSize="xs" flex="1" truncate>
              {commit.subject}
            </Text>
            <RelativeTime
              iso={commit.date}
              fontSize="2xs"
              color="fg.subtle"
              flexShrink="0"
            />
          </HStack>
        </CommitRow>
      ))}
    </Stack>
  );
}
