import { createListCollection, HStack, Select, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuColumns2, LuMonitor, LuRows3 } from "react-icons/lu";
import {
  type DiffViewMode,
  diffViewModes,
  setDiffViewMode,
  useDiffViewMode,
} from "../lib/diffViewMode";

const modeLabels: Record<DiffViewMode, string> = {
  inline: "Inline",
  split: "Split",
  dynamic: "Dynamic",
};

const modeIcons: Record<DiffViewMode, ReactNode> = {
  inline: <LuRows3 />,
  split: <LuColumns2 />,
  dynamic: <LuMonitor />,
};

const modeCollection = createListCollection({
  items: diffViewModes.map((mode) => ({
    label: modeLabels[mode],
    value: mode,
  })),
});

// Global diff layout picker, shown at the right end of the Review screen's
// tab bar. "Dynamic" picks per diff based on the space it has.
export default function DiffViewModeSelect() {
  const mode = useDiffViewMode();

  return (
    <Select.Root
      collection={modeCollection}
      value={[mode]}
      onValueChange={(event) => setDiffViewMode(event.value[0] as DiffViewMode)}
      size="xs"
      w="32"
    >
      <Select.HiddenSelect />
      <Select.Control>
        <Select.Trigger cursor="pointer" title="Diff layout">
          <HStack gap="1.5" minW="0" color="fg.muted">
            {modeIcons[mode]}
            <Select.ValueText />
          </HStack>
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Select.Positioner>
        <Select.Content>
          {modeCollection.items.map((item) => (
            <Select.Item item={item} key={item.value}>
              <HStack gap="1.5" flex="1" minW="0">
                {modeIcons[item.value]}
                <Text>{item.label}</Text>
              </HStack>
              <Select.ItemIndicator />
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Positioner>
    </Select.Root>
  );
}
