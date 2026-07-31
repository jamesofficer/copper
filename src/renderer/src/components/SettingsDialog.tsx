import { Box, CloseButton, Dialog, Flex, Portal, Tabs } from "@chakra-ui/react";
import {
  LuBrain,
  LuGithub,
  LuKeyRound,
  LuPalette,
  LuSparkles,
} from "react-icons/lu";
import { scrollbar } from "../lib/scrollbar";
import ApiKeysSettings from "./ApiKeysSettings";
import AppearanceSettings from "./AppearanceSettings";
import GitHubSettings from "./GitHubSettings";
import ModelSettings from "./ModelSettings";
import ReviewSettings from "./ReviewSettings";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
}

const TABS = [
  { value: "appearance", label: "Appearance", icon: <LuPalette /> },
  { value: "review", label: "Review", icon: <LuSparkles /> },
  { value: "models", label: "Models", icon: <LuBrain /> },
  { value: "keys", label: "Connections", icon: <LuKeyRound /> },
  { value: "github", label: "GitHub", icon: <LuGithub /> },
];

export default function SettingsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(event) => onOpenChange(event.open)}
      placement="center"
      size="xl"
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop backdropFilter="blur(2px)" />
        <Dialog.Positioner>
          <Dialog.Content
            maxW="4xl"
            w="full"
            h="min(40rem, 86vh)"
            overflow="hidden"
            p="0"
          >
            <Tabs.Root
              defaultValue="appearance"
              orientation="vertical"
              variant="subtle"
              h="full"
              minH="0"
            >
              <Flex
                direction="column"
                w="56"
                flexShrink="0"
                gap="3"
                p="3"
                borderRightWidth="1px"
                bg="bg.subtle"
              >
                <Dialog.Title
                  px="2"
                  pt="1"
                  fontSize="xs"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="wider"
                  color="fg.muted"
                >
                  Settings
                </Dialog.Title>
                <Tabs.List
                  gap="1"
                  w="full"
                  border="none"
                  flexDirection="column"
                  alignItems="stretch"
                >
                  {TABS.map((tab) => (
                    <Tabs.Trigger
                      key={tab.value}
                      value={tab.value}
                      justifyContent="flex-start"
                      cursor="pointer"
                      fontSize="sm"
                    >
                      {tab.icon} {tab.label}
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>
              </Flex>

              <Box
                flex="1"
                minW="0"
                minH="0"
                overflowY="auto"
                css={scrollbar}
                p="6"
              >
                <Tabs.Content value="appearance" p="0">
                  <AppearanceSettings />
                </Tabs.Content>
                <Tabs.Content value="review" p="0">
                  <ReviewSettings />
                </Tabs.Content>
                <Tabs.Content value="models" p="0">
                  <ModelSettings />
                </Tabs.Content>
                <Tabs.Content value="keys" p="0">
                  <ApiKeysSettings open={open} />
                </Tabs.Content>
                <Tabs.Content value="github" p="0">
                  <GitHubSettings open={open} />
                </Tabs.Content>
              </Box>
            </Tabs.Root>

            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
