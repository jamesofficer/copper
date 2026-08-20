import {
  Box,
  createListCollection,
  HStack,
  Select,
  Text,
} from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { LuMonitor, LuMoon, LuSun } from "react-icons/lu";
import {
  type AccentPalette,
  accentPalettes,
  applyAccent,
  getAccent,
} from "../lib/accent";
import {
  applyColorMode,
  type ColorModeSetting,
  colorModeSettings,
  getColorMode,
} from "../lib/colorMode";
import {
  type FilePathDisplay,
  filePathDisplays,
  setFilePathDisplay,
  useFilePathDisplay,
} from "../lib/filePathDisplay";
import { SettingRow, SettingsGroup, SettingsPanel } from "./SettingsLayout";
import SyntaxThemePicker from "./SyntaxThemePicker";

const modeLabels: Record<ColorModeSetting, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const modeIcons: Record<ColorModeSetting, ReactNode> = {
  light: <LuSun />,
  dark: <LuMoon />,
  system: <LuMonitor />,
};

const modeCollection = createListCollection({
  items: colorModeSettings.map((mode) => ({
    label: modeLabels[mode],
    value: mode,
  })),
});

const accentCollection = createListCollection({
  items: accentPalettes.map((palette) => ({ label: palette, value: palette })),
});

const pathDisplayLabels: Record<FilePathDisplay, string> = {
  inline: "Full path",
  filename: "File name only",
  stacked: "File name, path below",
};

const pathDisplayCollection = createListCollection({
  items: filePathDisplays.map((value) => ({
    label: pathDisplayLabels[value],
    value,
  })),
});

function Swatch({ palette }: { palette: string }) {
  return (
    <Box w="3" h="3" rounded="full" bg={`${palette}.solid`} flexShrink="0" />
  );
}

export default function AppearanceSettings() {
  const pathDisplay = useFilePathDisplay();
  const [mode, setMode] = useState<ColorModeSetting>(getColorMode);
  const [accent, setAccent] = useState<AccentPalette>(getAccent);

  function selectMode(setting: ColorModeSetting) {
    applyColorMode(setting);
    setMode(setting);
  }

  function selectAccent(palette: AccentPalette) {
    applyAccent(palette);
    setAccent(palette);
  }

  return (
    <SettingsPanel
      title="Appearance"
      description="How the app looks: its theme, accent colour, code colours, and the way file paths are written."
    >
      <SettingsGroup>
        <SettingRow
          title="Theme"
          description="Light, dark, or follow your system setting."
        >
          <Select.Root
            collection={modeCollection}
            value={[mode]}
            onValueChange={(event) =>
              selectMode(event.value[0] as ColorModeSetting)
            }
            size="sm"
            w="52"
          >
            <Select.HiddenSelect />
            <Select.Control>
              <Select.Trigger cursor="pointer">
                <HStack gap="2" minW="0">
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
                    <HStack gap="2" flex="1" minW="0">
                      {modeIcons[item.value]}
                      <Text>{item.label}</Text>
                    </HStack>
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
        </SettingRow>

        <SettingRow
          title="Accent colour"
          description="Used for buttons, tabs, links, and highlights across the app."
        >
          <Select.Root
            collection={accentCollection}
            value={[accent]}
            onValueChange={(event) =>
              selectAccent(event.value[0] as AccentPalette)
            }
            size="sm"
            w="52"
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
        </SettingRow>

        <SettingRow
          title="Syntax theme"
          description="Code colours in diffs, file views, and markdown code blocks. Each colour mode keeps its own theme."
          stacked
        >
          <SyntaxThemePicker />
        </SettingRow>

        <SettingRow
          title="File paths"
          description="How file paths are written in the Changes tab's file list."
        >
          <Select.Root
            collection={pathDisplayCollection}
            value={[pathDisplay]}
            onValueChange={(event) =>
              setFilePathDisplay(event.value[0] as FilePathDisplay)
            }
            size="sm"
            w="52"
          >
            <Select.HiddenSelect />
            <Select.Control>
              <Select.Trigger cursor="pointer">
                <Select.ValueText />
              </Select.Trigger>
              <Select.IndicatorGroup>
                <Select.Indicator />
              </Select.IndicatorGroup>
            </Select.Control>
            <Select.Positioner>
              <Select.Content>
                {pathDisplayCollection.items.map((item) => (
                  <Select.Item item={item} key={item.value}>
                    <Text flex="1">{item.label}</Text>
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
        </SettingRow>
      </SettingsGroup>
    </SettingsPanel>
  );
}
