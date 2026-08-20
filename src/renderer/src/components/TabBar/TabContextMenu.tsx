import { Menu, Portal } from "@chakra-ui/react";
import type { ReactElement } from "react";
import { LuChevronsRight, LuCircleX, LuX } from "react-icons/lu";
import type { TabMenuAvailability } from "../../lib/tabs/tabs";

// The menu that a right-click on a tab opens. It wraps the tab, because Chakra
// puts the trigger on the element that the user clicks and Menu.Root itself
// draws nothing.
//
// An item that can do nothing is disabled and not hidden. A menu that changes
// shape from one tab to the next makes the user hunt for the item each time.

export interface TabMenuActions {
  availability: TabMenuAvailability;
  onClose(): void;
  onCloseOthers(): void;
  onCloseToRight(): void;
}

interface Props extends TabMenuActions {
  children: ReactElement;
}

export default function TabContextMenu({
  availability,
  onClose,
  onCloseOthers,
  onCloseToRight,
  children,
}: Props) {
  return (
    <Menu.Root>
      <Menu.ContextTrigger asChild>{children}</Menu.ContextTrigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="48">
            <Menu.Item
              value="close"
              disabled={!availability.canClose}
              onClick={onClose}
            >
              <LuX /> Close
            </Menu.Item>
            <Menu.Item
              value="close-others"
              disabled={!availability.canCloseOthers}
              onClick={onCloseOthers}
            >
              <LuCircleX /> Close others
            </Menu.Item>
            <Menu.Item
              value="close-to-right"
              disabled={!availability.canCloseToRight}
              onClick={onCloseToRight}
            >
              <LuChevronsRight /> Close to the right
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
