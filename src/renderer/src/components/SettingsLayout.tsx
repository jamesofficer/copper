import { Box, Heading, Separator, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  description: string;
  children: ReactNode;
}

// One settings tab: a heading, then cards of rows. Every tab uses these three
// pieces, so the four tabs look like one screen instead of four forms.
export function SettingsPanel({ title, description, children }: PanelProps) {
  return (
    <Stack gap="5" alignItems="stretch">
      <Stack gap="1" pr="8">
        <Heading size="md">{title}</Heading>
        <Text fontSize="sm" color="fg.muted">
          {description}
        </Text>
      </Stack>
      {children}
    </Stack>
  );
}

interface GroupProps {
  children: ReactNode;
}

export function SettingsGroup({ children }: GroupProps) {
  return (
    <Box borderWidth="1px" rounded="lg" bg="bg.panel" overflow="hidden">
      <Stack gap="0" separator={<Separator />}>
        {children}
      </Stack>
    </Box>
  );
}

interface RowProps {
  title: string;
  description?: string;
  // Puts the control under the text instead of beside it — for wide controls
  // like radio lists and key fields.
  stacked?: boolean;
  children: ReactNode;
}

export function SettingRow({
  title,
  description,
  stacked,
  children,
}: RowProps) {
  return (
    <Stack
      direction={stacked ? "column" : "row"}
      alignItems={stacked ? "stretch" : "center"}
      justifyContent="space-between"
      gap={stacked ? "3" : "6"}
      p="4"
    >
      <Stack gap="0.5" minW="0">
        <Text fontSize="sm" fontWeight="medium">
          {title}
        </Text>
        {description && (
          <Text fontSize="xs" color="fg.muted" lineHeight="1.5">
            {description}
          </Text>
        )}
      </Stack>
      <Box flexShrink="0" minW="0">
        {children}
      </Box>
    </Stack>
  );
}
