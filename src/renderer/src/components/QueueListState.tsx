import { Alert, Box, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import type { Repository } from "../../../shared/types";
import { scrollbar } from "../lib/scrollbar";
import NoRepositoriesEmptyState from "./NoRepositoriesEmptyState";

interface Props {
  // Plural, lower case: "pull requests", "issues". Three of the four messages
  // are built from it, so the two tabs can't word the same situation
  // differently.
  noun: string;
  noRepositories: boolean;
  // What the reader would be able to do with a repository, for the empty state.
  addRepoPurpose: string;
  onAddRepo(): void;
  // The selected repository, or null when the reader hasn't picked one. Passed
  // whole rather than as a slug: "no repo selected" and "repo without a GitHub
  // remote" need different answers, and one nullable string conflates them.
  repo: Repository | null;
  error: string | null;
  pending: boolean;
  empty: boolean;
  // Said in the list's own voice, so it stays per-tab.
  emptyText: string;
  children: ReactNode;
}

// Everything the queue shows in place of rows, in one place: the two list tabs
// answer "why is there no list" identically, and a second copy of this ladder
// is how they'd stop doing that.
export default function QueueListState({
  noun,
  noRepositories,
  addRepoPurpose,
  onAddRepo,
  repo,
  error,
  pending,
  empty,
  emptyText,
  children,
}: Props) {
  if (noRepositories) {
    return (
      <Message>
        <NoRepositoriesEmptyState
          purpose={addRepoPurpose}
          onAddRepo={onAddRepo}
        />
      </Message>
    );
  }

  // Nothing selected is not a message — the reader hasn't asked for anything
  // yet. A selected repo with no GitHub remote is.
  if (!repo) return null;

  if (!repo.slug) {
    return (
      <Message>
        <Text fontSize="sm" color="fg.muted">
          This repository has no GitHub remote, so {noun} can’t be loaded.
        </Text>
      </Message>
    );
  }

  if (error) {
    return (
      <Message>
        <Alert.Root status="error" rounded="lg">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Couldn’t load {noun}</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      </Message>
    );
  }

  if (pending) {
    return (
      <Message>
        <HStack color="fg.muted">
          <Spinner size="sm" />
          <Text fontSize="sm">Loading open {noun}…</Text>
        </HStack>
      </Message>
    );
  }

  if (empty) {
    return (
      <Message>
        <Text fontSize="sm" color="fg.muted">
          {emptyText}
        </Text>
      </Message>
    );
  }

  return children;
}

// Scrolls, since a repo with no GitHub remote still gets a paragraph and a
// button.
function Message({ children }: { children: ReactNode }) {
  return (
    <Box flex="1" minH="0" overflowY="auto" px="4" py="4" css={scrollbar}>
      <Stack gap="3">{children}</Stack>
    </Box>
  );
}
