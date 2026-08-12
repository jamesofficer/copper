import { HStack, Text } from "@chakra-ui/react";
import { LuGitBranch } from "react-icons/lu";

interface Props {
  name: string;
}

// The checkout's current branch, shown in place of the worktree switcher when
// the repo has only one checkout to offer.
export default function BranchLabel({ name }: Props) {
  return (
    <HStack gap="1" fontFamily="mono" fontSize="xs" color="fg.muted" minW="0">
      <LuGitBranch size={12} />
      <Text as="span" truncate>
        {name}
      </Text>
    </HStack>
  );
}
