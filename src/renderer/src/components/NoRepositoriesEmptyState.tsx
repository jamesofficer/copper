import { Button, EmptyState, VStack } from "@chakra-ui/react";
import { LuFolderGit2, LuFolderPlus } from "react-icons/lu";

interface Props {
  // What the repository unlocks, phrased for the tab asking. E.g. "start
  // reviewing its pull requests".
  purpose: string;
  onAddRepo(): void;
}

// The home screen's "nothing added yet" state, shown by every tab of the main
// column since none of them can do anything without a repository.
export default function NoRepositoriesEmptyState({
  purpose,
  onAddRepo,
}: Props) {
  return (
    <EmptyState.Root
      borderWidth="1px"
      borderStyle="dashed"
      rounded="xl"
      maxW="2xl"
    >
      <EmptyState.Content>
        <EmptyState.Indicator>
          <LuFolderGit2 />
        </EmptyState.Indicator>
        <VStack textAlign="center">
          <EmptyState.Title>No repositories yet</EmptyState.Title>
          <EmptyState.Description>
            Add a local git repository to {purpose}.
          </EmptyState.Description>
        </VStack>
        <Button onClick={onAddRepo}>
          <LuFolderPlus /> Add repository
        </Button>
      </EmptyState.Content>
    </EmptyState.Root>
  );
}
