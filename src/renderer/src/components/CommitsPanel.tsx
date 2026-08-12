import { Box, Collapsible, Heading, HStack, Text } from "@chakra-ui/react";
import { LuChevronRight } from "react-icons/lu";
import type { PullRequestCommit } from "../../../shared/types";
import { scrollbar } from "../lib/scrollbar";
import CommitList from "./CommitList";

interface Props {
  commits: PullRequestCommit[];
  selectedSha: string | null;
  onSelect(sha: string | null): void;
  // The row that points the view back at everything: "All changes" on a PR,
  // "Uncommitted changes" on the local one.
  allLabel: string;
  // git log is already newest first; GitHub's API is not.
  newestFirst?: boolean;
  // Said beside the heading while no commit is picked — the local list uses it
  // to name the ref the branch is measured against.
  hint?: string;
}

// The branch's commits, anchored to the foot of the file-list column in both
// Changes views. Below the files, not above them: the changed files are what
// the column is opened for, and history is what you go looking for. Collapsed
// by default for the same reason.
export default function CommitsPanel({
  commits,
  selectedSha,
  onSelect,
  allLabel,
  newestFirst,
  hint,
}: Props) {
  const note = selectedSha ? selectedSha.slice(0, 7) : hint;

  return (
    <Collapsible.Root flexShrink="0" borderTopWidth="1px">
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
          {note && (
            <Text fontFamily="mono" fontSize="2xs" truncate>
              · {note}
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
            selectedSha={selectedSha}
            onSelect={onSelect}
            allLabel={allLabel}
            newestFirst={newestFirst}
          />
        </Box>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
