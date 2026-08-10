import { createListCollection, HStack, Portal, Select } from "@chakra-ui/react";
import { useMemo } from "react";
import UserAvatar from "./UserAvatar";

export interface FilterItem {
  value: string;
  label: string;
  // GitHub login to show an avatar for — absent on "All …"/sort options.
  avatar?: string;
}

interface Props {
  label: string;
  items: FilterItem[];
  value: string;
  width?: string;
  onChange(value: string): void;
}

// The small GitHub-style dropdown above the home screen's lists. Domain-free —
// pull requests and issues both filter through it.
export default function FilterSelect({
  label,
  items,
  value,
  width = "150px",
  onChange,
}: Props) {
  const collection = useMemo(() => createListCollection({ items }), [items]);
  return (
    <Select.Root
      collection={collection}
      value={[value]}
      onValueChange={(event) => onChange(event.value[0] ?? "all")}
      size="xs"
      width={width}
    >
      <Select.HiddenSelect />
      <Select.Control>
        <Select.Trigger cursor="pointer">
          <Select.ValueText placeholder={label} />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal>
        <Select.Positioner>
          <Select.Content>
            {collection.items.map((item) => (
              <Select.Item item={item} key={item.value}>
                <HStack gap="2" flex="1" minW="0">
                  {item.avatar && <UserAvatar username={item.avatar} />}
                  <Select.ItemText>{item.label}</Select.ItemText>
                </HStack>
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  );
}
