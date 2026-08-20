import { Box, HStack, Icon, IconButton, Text } from "@chakra-ui/react";
import type { CSSProperties, ReactElement } from "react";
import {
  LuCircleDot,
  LuGitBranch,
  LuGitPullRequest,
  LuLayoutList,
  LuX,
} from "react-icons/lu";
import { describeTab, type TabIcon } from "../../lib/tabs/tabLabel";
import { QUEUE_TAB_ID, type Tab } from "../../lib/tabs/tabs";
import TabContextMenu, { type TabMenuActions } from "./TabContextMenu";

// One tab in the row. The name is TabItem and not TabContent. Chakra gives the
// name Tabs.Content to the panel below a tab, and this component is the tab.
//
// The component does not read the store. TabBar gives it everything, so the
// same component can also draw the copy that moves with the pointer.

const icons: Record<TabIcon, ReactElement> = {
  queue: <LuLayoutList />,
  pullRequest: <LuGitPullRequest />,
  repoIssues: <LuCircleDot />,
  branch: <LuGitBranch />,
};

// The close button appears when the pointer is over the tab. It also appears
// when the button has the keyboard focus, or a user on the keyboard could
// never reach it.
const revealed = ".group:hover &, .group:has(:focus-visible) &";

export interface TabItemProps {
  tab: Tab;
  active: boolean;
  // Absent on the copy that moves with the pointer, which is only a picture.
  onSelect?(id: string): void;
  onClose?(id: string): void;
  ref?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  // The tab that stays in the row while the copy moves. It marks the position.
  dimmed?: boolean;
  dragging?: boolean;
  handleProps?: Record<string, unknown>;
  // Absent on the copy that moves with the pointer, which is only a picture.
  menuActions?: TabMenuActions;
}

export default function TabItem({
  tab,
  active,
  onSelect,
  onClose,
  ref,
  style,
  dimmed,
  dragging,
  handleProps,
  menuActions,
}: TabItemProps) {
  const label = describeTab(tab);
  const queue = tab.id === QUEUE_TAB_ID;

  const item = (
    <HStack
      ref={ref}
      className="group"
      // The accent bar is positioned against this box.
      position="relative"
      gap="1"
      // The queue tab holds an icon and one short word, so it needs no more
      // room. The other tabs get a fixed width and do not become narrow.
      w={queue ? "auto" : "200px"}
      flexShrink="0"
      alignSelf="center"
      h="8"
      px="2"
      rounded="md"
      cursor={dragging ? "grabbing" : "pointer"}
      opacity={dimmed ? 0.35 : undefined}
      bg={active ? "bg.panel" : undefined}
      shadow={dragging ? "md" : undefined}
      borderWidth="1px"
      borderColor={active ? "border.emphasized" : "transparent"}
      _hover={active ? undefined : { bg: "bg.muted" }}
      style={style}
      // The middle button closes a tab. Browsers and editors use the same rule.
      onAuxClick={(event) => {
        if (event.button === 1 && label.closable) onClose?.(tab.id);
      }}
      {...handleProps}
    >
      {/* The accent bar marks the active tab. A colour alone is not enough in
          a light theme, where the active and the inactive backgrounds are
          close. */}
      <Box
        position="absolute"
        top="0"
        left="2"
        right="2"
        h="2px"
        rounded="full"
        bg={active ? "colorPalette.solid" : "transparent"}
      />
      <Icon
        size="sm"
        flexShrink="0"
        color={active ? "colorPalette.fg" : "fg.muted"}
      >
        {icons[label.icon]}
      </Icon>
      <HStack
        as="button"
        flex="1"
        minW="0"
        gap="1.5"
        cursor="pointer"
        title={label.tooltip}
        onClick={() => onSelect?.(tab.id)}
      >
        {label.prefix && (
          <Text fontSize="xs" fontFamily="mono" color="fg.muted" flexShrink="0">
            {label.prefix}
          </Text>
        )}
        <Text
          fontSize="sm"
          truncate
          color={active ? "fg" : "fg.muted"}
          fontWeight={active ? "medium" : undefined}
        >
          {label.text}
        </Text>
      </HStack>
      {label.closable && onClose && (
        <IconButton
          aria-label={`Close ${label.text}`}
          size="2xs"
          variant="ghost"
          color="fg.muted"
          flexShrink="0"
          opacity="0"
          css={{ [revealed]: { opacity: 1 } }}
          onClick={() => onClose(tab.id)}
        >
          <LuX />
        </IconButton>
      )}
    </HStack>
  );

  if (!menuActions) return item;
  return <TabContextMenu {...menuActions}>{item}</TabContextMenu>;
}
