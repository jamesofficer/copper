import {
  Box,
  createListCollection,
  HStack,
  Select,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useMemo } from "react";
import { highlightToLines } from "../lib/highlighter";
import { tokenColors } from "../lib/syntaxColors";
import { setSyntaxTheme, useSyntaxThemes } from "../lib/syntaxTheme";
import {
  findSyntaxTheme,
  type SyntaxTheme,
  syntaxThemesFor,
  type ThemeAppearance,
} from "../lib/syntaxThemeCatalog";
import { diffFontStyles } from "./DiffLines";

// Short enough to stay readable at preview size, but with a keyword, a type,
// a string, a comment, and a number — the tokens themes differ most on.
const SAMPLE = `// greet the reviewer
export function greet(name: string) {
  return \`Hi, \${name}\` + 1;
}`;

const collections = {
  dark: createListCollection({
    items: syntaxThemesFor("dark"),
    itemToString: (theme: SyntaxTheme) => theme.label,
    itemToValue: (theme: SyntaxTheme) => theme.id,
  }),
  light: createListCollection({
    items: syntaxThemesFor("light"),
    itemToString: (theme: SyntaxTheme) => theme.label,
    itemToValue: (theme: SyntaxTheme) => theme.id,
  }),
};

function Swatch({ theme }: { theme: SyntaxTheme | undefined }) {
  return (
    <Box
      w="3.5"
      h="3.5"
      rounded="xs"
      flexShrink="0"
      borderWidth="1px"
      borderColor="border"
      bg={theme?.bg ?? "bg.subtle"}
    />
  );
}

// Renders the sample in one theme regardless of the app's current colour
// mode, by handing the highlighter that theme for both halves of the pair —
// so the light preview is honest even while the app is dark.
function Preview({ themeId }: { themeId: string }) {
  const theme = findSyntaxTheme(themeId);
  const lines = useMemo(
    () =>
      highlightToLines(SAMPLE, "typescript", {
        dark: themeId,
        light: themeId,
      }) ?? [],
    [themeId],
  );

  return (
    <Box
      {...diffFontStyles}
      css={tokenColors}
      fontSize="xs"
      rounded="md"
      borderWidth="1px"
      p="2.5"
      overflowX="auto"
      bg={theme?.bg ?? "bg.subtle"}
      color={theme?.fg ?? "fg"}
    >
      {lines.map((html, index) => (
        <Text
          // biome-ignore lint/suspicious/noArrayIndexKey: the index IS the line number
          key={index}
          as="div"
          whiteSpace="pre"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: highlighter output is escaped
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ))}
    </Box>
  );
}

interface ColumnProps {
  appearance: ThemeAppearance;
  label: string;
  value: string;
}

function Column({ appearance, label, value }: ColumnProps) {
  return (
    <Stack gap="2" flex="1" minW="0">
      <Text fontSize="xs" fontWeight="medium" color="fg.muted">
        {label}
      </Text>
      <Select.Root
        collection={collections[appearance]}
        value={[value]}
        onValueChange={(event) => setSyntaxTheme(appearance, event.value[0])}
        size="sm"
      >
        <Select.HiddenSelect />
        <Select.Control>
          <Select.Trigger cursor="pointer">
            <HStack gap="2" minW="0">
              <Swatch theme={findSyntaxTheme(value)} />
              <Select.ValueText />
            </HStack>
          </Select.Trigger>
          <Select.IndicatorGroup>
            <Select.Indicator />
          </Select.IndicatorGroup>
        </Select.Control>
        <Select.Positioner>
          <Select.Content maxH="72">
            {collections[appearance].items.map((theme) => (
              <Select.Item item={theme} key={theme.id}>
                <HStack gap="2" flex="1" minW="0">
                  <Swatch theme={theme} />
                  <Text truncate>{theme.label}</Text>
                </HStack>
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Select.Root>
      <Preview themeId={value} />
    </Stack>
  );
}

// Both modes are shown side by side, not just the active one: the setting is
// a pair, and picking a light theme while the app is in dark mode is exactly
// when the preview matters.
export default function SyntaxThemePicker() {
  const themes = useSyntaxThemes();

  return (
    <Stack direction={{ base: "column", md: "row" }} gap="4" w="full">
      <Column appearance="light" label="Light mode" value={themes.light} />
      <Column appearance="dark" label="Dark mode" value={themes.dark} />
    </Stack>
  );
}
