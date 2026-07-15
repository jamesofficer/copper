import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import type { PullRequestCommit } from "../../../shared/types";

interface Props {
  commits: PullRequestCommit[];
  selectedSha: string | null;
  onSelect(sha: string | null): void;
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

export default function CommitList({ commits, selectedSha, onSelect }: Props) {
  return (
    <Stack gap="0.5">
      <CommitRow selected={selectedSha === null} onClick={() => onSelect(null)}>
        <Text fontSize="xs" fontWeight="medium">
          All changes
        </Text>
      </CommitRow>
      {commits.map((commit) => (
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
          </HStack>
        </CommitRow>
      ))}
    </Stack>
  );
}
