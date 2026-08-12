import {
  createListCollection,
  HStack,
  Portal,
  Select,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useMemo } from "react";
import { LuGitBranch } from "react-icons/lu";
import type { Worktree } from "../../../shared/types";

interface Props {
  worktrees: Worktree[];
  value: string;
  onChange(path: string): void;
}

function folderName(path: string): string {
  return path.split("/").pop() ?? path;
}

// Picks which of the repo's checkouts the Current changes tab reads — the
// main worktree or a linked git worktree (e.g. one an agent is working in).
// Only rendered when the repo has more than one.
export default function WorktreeSelect({ worktrees, value, onChange }: Props) {
  const collection = useMemo(
    () =>
      createListCollection({
        items: worktrees.map((worktree) => ({
          value: worktree.path,
          label: worktree.branch ?? folderName(worktree.path),
          worktree,
        })),
      }),
    [worktrees],
  );

  return (
    <Select.Root
      collection={collection}
      value={[value]}
      onValueChange={(event) => {
        if (event.value[0]) onChange(event.value[0]);
      }}
      size="xs"
      w="full"
    >
      <Select.HiddenSelect />
      <Select.Control>
        <Select.Trigger cursor="pointer" title="Switch worktree">
          {/* pe clears the chevron, which is positioned over the trigger's own
              padding. maxW undoes the recipe's 80% cap on the value text —
              without it a branch name ellipses with a third of the box empty. */}
          <HStack gap="1.5" flex="1" minW="0" pe="5" color="fg.muted">
            <LuGitBranch size={12} />
            <Text as="span" fontFamily="mono" fontSize="xs" flex="1" minW="0">
              <Select.ValueText
                placeholder="Select worktree"
                display="block"
                maxW="full"
                truncate
              />
            </Text>
          </HStack>
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      {/* Portalled so the menu stacks above the tab bar's neighbours. */}
      <Portal>
        <Select.Positioner>
          <Select.Content minW="56">
            {collection.items.map((item) => (
              <Select.Item item={item} key={item.value}>
                <Stack gap="0" flex="1" minW="0">
                  <Text fontFamily="mono" fontSize="xs" truncate>
                    {item.worktree.branch ?? "detached HEAD"}
                  </Text>
                  <Text fontSize="xs" color="fg.muted" truncate>
                    {folderName(item.worktree.path)}
                    {item.worktree.isMain ? " (main worktree)" : ""}
                  </Text>
                </Stack>
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  );
}
