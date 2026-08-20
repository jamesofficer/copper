import { Box, Flex, HStack, Icon, IconButton, Text } from "@chakra-ui/react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type CSSProperties, type ReactElement, useState } from "react";
import {
  LuGitBranch,
  LuGitPullRequest,
  LuLayoutList,
  LuX,
} from "react-icons/lu";
import { scrollbar } from "../lib/scrollbar";
import { describeTab, sortableTabIds, type TabIcon } from "../lib/tabLabel";
import { QUEUE_TAB_ID, type Tab } from "../lib/tabs";
import {
  dragRegion,
  noDragRegion,
  titleBarHeight,
  trafficLightSpace,
} from "../lib/titleBar";
import { useTabs } from "../lib/useTabs";
import ShowSidebarButton from "./ShowSidebarButton";

// The row of open tabs, at the top of the window. On macOS it is also the drag
// bar for the window, and it keeps space for the traffic lights while the
// sidebar is hidden.
//
// The tabs do not become narrow when the row is full. The row scrolls instead.
// A narrow tab hides its title, and the title is the only part that tells two
// pull requests apart.

const icons: Record<TabIcon, ReactElement> = {
  queue: <LuLayoutList />,
  pullRequest: <LuGitPullRequest />,
  branch: <LuGitBranch />,
};

export default function TabBar() {
  const tabs = useTabs((state) => state.tabs);
  const activeId = useTabs((state) => state.activeId);
  const activateTab = useTabs((state) => state.activateTab);
  const closeTab = useTabs((state) => state.closeTab);
  const moveTab = useTabs((state) => state.moveTab);
  const [dragged, setDragged] = useState<Tab | null>(null);

  // The drag starts after 4px of movement, so a plain click still selects the
  // tab. This is the same rule as the repository rows.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    setDragged(tabs.find((tab) => tab.id === event.active.id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragged(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const to = tabs.findIndex((tab) => tab.id === over.id);
    if (to < 0) return;
    moveTab(String(active.id), to);
  }

  const queue = tabs.find((tab) => tab.id === QUEUE_TAB_ID);
  const rest = tabs.filter((tab) => tab.id !== QUEUE_TAB_ID);

  return (
    <Flex
      as="header"
      h={titleBarHeight}
      flexShrink="0"
      align="stretch"
      gap="1"
      pl={trafficLightSpace}
      pr="2"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      bg="bg.subtle"
      css={dragRegion}
    >
      <HStack gap="1" flexShrink="0" alignSelf="center" css={noDragRegion}>
        <ShowSidebarButton />
      </HStack>

      <HStack
        gap="1"
        flex="1"
        minW="0"
        align="stretch"
        overflowX="auto"
        overflowY="hidden"
        css={{ ...noDragRegion, ...scrollbar }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDragged(null)}
        >
          {/* The queue tab is outside the sortable list, because it cannot
              move and nothing can move in front of it. */}
          {queue && (
            <TabContent
              tab={queue}
              active={activeId === queue.id}
              onSelect={activateTab}
            />
          )}
          <SortableContext
            items={sortableTabIds(tabs)}
            strategy={horizontalListSortingStrategy}
          >
            {rest.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                active={activeId === tab.id}
                onSelect={activateTab}
                onClose={closeTab}
              />
            ))}
          </SortableContext>
          <DragOverlay>
            {dragged && (
              <TabContent
                tab={dragged}
                active={dragged.id === activeId}
                dragging
              />
            )}
          </DragOverlay>
        </DndContext>
      </HStack>
    </Flex>
  );
}

interface SortableTabProps {
  tab: Tab;
  active: boolean;
  onSelect(id: string): void;
  onClose(id: string): void;
}

function SortableTab({ tab, active, onSelect, onClose }: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  return (
    <TabContent
      tab={tab}
      active={active}
      onSelect={onSelect}
      onClose={onClose}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: "none",
      }}
      dimmed={isDragging}
      handleProps={{ ...attributes, ...listeners }}
    />
  );
}

interface TabContentProps {
  tab: Tab;
  active: boolean;
  // Absent on the DragOverlay copy, which is only a picture.
  onSelect?(id: string): void;
  onClose?(id: string): void;
  ref?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  // The tab that stays in the row while the copy moves. It marks the position.
  dimmed?: boolean;
  dragging?: boolean;
  handleProps?: Record<string, unknown>;
}

// The close button appears when the pointer is over the tab. It also appears
// when the button has the keyboard focus, or a user on the keyboard could
// never reach it.
const revealed = ".group:hover &, .group:has(:focus-visible) &";

function TabContent({
  tab,
  active,
  onSelect,
  onClose,
  ref,
  style,
  dimmed,
  dragging,
  handleProps,
}: TabContentProps) {
  const label = describeTab(tab);
  const queue = tab.id === QUEUE_TAB_ID;

  return (
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
}
