import {
  Box,
  createListCollection,
  HStack,
  Select,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import {
  type AccentPalette,
  accentPalettes,
  applyAccent,
  getAccent,
} from "../lib/accent";

const accentCollection = createListCollection({
  items: accentPalettes.map((palette) => ({ label: palette, value: palette })),
});

function Swatch({ palette }: { palette: string }) {
  return (
    <Box w="3" h="3" rounded="full" bg={`${palette}.solid`} flexShrink="0" />
  );
}

export default function AppearanceSettings() {
  const [accent, setAccent] = useState<AccentPalette>(getAccent);

  function selectAccent(palette: AccentPalette) {
    applyAccent(palette);
    setAccent(palette);
  }

  return (
    <Stack gap="3">
      <Box>
        <Text fontWeight="medium">Accent colour</Text>
        <Text fontSize="sm" color="fg.muted">
          Used for buttons, tabs, links, and highlights across the app.
        </Text>
      </Box>
      <Select.Root
        collection={accentCollection}
        value={[accent]}
        onValueChange={(event) => selectAccent(event.value[0] as AccentPalette)}
        size="sm"
        maxW="56"
      >
        <Select.HiddenSelect />
        <Select.Control>
          <Select.Trigger cursor="pointer">
            <HStack gap="2" minW="0">
              <Swatch palette={accent} />
              <Select.ValueText textTransform="capitalize" />
            </HStack>
          </Select.Trigger>
          <Select.IndicatorGroup>
            <Select.Indicator />
          </Select.IndicatorGroup>
        </Select.Control>
        <Select.Positioner>
          <Select.Content>
            {accentCollection.items.map((item) => (
              <Select.Item item={item} key={item.value}>
                <HStack gap="2" flex="1" minW="0">
                  <Swatch palette={item.value} />
                  <Text textTransform="capitalize">{item.label}</Text>
                </HStack>
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Select.Root>
    </Stack>
  );
}
