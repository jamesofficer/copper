import { Button, CloseButton, Dialog, Portal, Tabs } from "@chakra-ui/react";
import { LuKeyRound, LuPalette } from "react-icons/lu";
import ApiKeysSettings from "./ApiKeysSettings";
import AppearanceSettings from "./AppearanceSettings";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
}

export default function SettingsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(event) => onOpenChange(event.open)}
      placement="center"
      size="lg"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Settings</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Tabs.Root
                defaultValue="appearance"
                orientation="vertical"
                variant="subtle"
                minH="sm"
              >
                <Tabs.List gap="1" minW="36" flexShrink="0">
                  <Tabs.Trigger value="appearance" justifyContent="flex-start">
                    <LuPalette /> Appearance
                  </Tabs.Trigger>
                  <Tabs.Trigger value="keys" justifyContent="flex-start">
                    <LuKeyRound /> API keys
                  </Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content value="appearance" pl="6" py="0" flex="1">
                  <AppearanceSettings />
                </Tabs.Content>
                <Tabs.Content value="keys" pl="6" py="0" flex="1">
                  <ApiKeysSettings open={open} />
                </Tabs.Content>
              </Tabs.Root>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Done</Button>
              </Dialog.ActionTrigger>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
