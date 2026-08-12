import { Box, Center, Flex, Text } from "@chakra-ui/react";
import type { LocalChangesState } from "../lib/useLocalChanges";
import CommitMessageHeader from "./CommitMessageHeader";
import DiffView from "./DiffView";

interface Props {
  state: LocalChangesState;
}

// A filter that hides every file leaves this pane empty too, and saying the
// commit changed nothing would be a lie the column beside it contradicts.
function placeholder(state: LocalChangesState): string {
  if (state.commit) {
    if (state.commitFilesPending) return "Reading the commit…";
    if (state.commitFileTotal === 0) return "This commit changed no files.";
    return "No files match your filter.";
  }
  if (state.changesPending) return "Reading local changes…";
  if (state.changedPaths === 0) {
    return "The working tree is clean — nothing to review.";
  }
  if (state.filtering) return "No files match your filter.";
  return "Select a file to view its diff.";
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
              {placeholder(state)}
            </Text>
          </Center>
        )}
      </Box>
    </Flex>
  );
}
