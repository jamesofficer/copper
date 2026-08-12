import { Box, Center, Flex, Text } from "@chakra-ui/react";
import type { LocalChangesState } from "../lib/useLocalChanges";
import CommitMessageHeader from "./CommitMessageHeader";
import DiffView from "./DiffView";

interface Props {
  state: LocalChangesState;
}

// The diff beside the Changes tab's file column. It starts under the queue's
// top bar rather than under the tab bar, because the tab bar caps the column
// and not the window.
export default function LocalChangesPane({ state }: Props) {
  const { commit, shownFile } = state;

  return (
    <Flex direction="column" flex="1" minH="0" minW="0">
      {commit && <CommitMessageHeader commit={commit} />}
      <Box flex="1" minH="0" minW="0">
        {shownFile ? (
          <DiffView
            key={`${commit?.sha ?? state.selectedArea}:${shownFile.path}`}
            file={shownFile}
          />
        ) : (
          <Center h="full" p="4">
            <Text color="fg.muted" fontSize="sm">
              {commit
                ? state.commitFilesPending
                  ? "Reading the commit…"
                  : "This commit changed no files."
                : state.changesPending
                  ? "Reading local changes…"
                  : state.changedPaths === 0
                    ? "The working tree is clean — nothing to review."
                    : "Select a file to view its diff."}
            </Text>
          </Center>
        )}
      </Box>
    </Flex>
  );
}
