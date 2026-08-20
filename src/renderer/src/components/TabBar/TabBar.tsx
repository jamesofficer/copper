import { Flex, HStack } from "@chakra-ui/react";
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
} from "@dnd-kit/sortable";
import { useState } from "react";
import { scrollbar } from "../../lib/scrollbar";
import { useSidebarCollapsed } from "../../lib/sidebarCollapsed";
import { sortableTabIds } from "../../lib/tabs/tabLabel";
import {
  QUEUE_TAB_ID,
  type Tab,
  tabMenuAvailability,
} from "../../lib/tabs/tabs";
import { useTabs } from "../../lib/tabs/useTabs";
import {
  dragRegion,
  noDragRegion,
  titleBarHeight,
  trafficLightSpace,
} from "../../lib/titleBar";
import ShowSidebarButton from "../ShowSidebarButton";
import SortableTab from "./SortableTab";
import TabItem from "./TabItem";

// The row of open tabs, at the top of the window. On macOS it is also the drag
// bar for the window, and it keeps space for the traffic lights while the
// sidebar is hidden.
//
// The tabs do not become narrow when the row is full. The row scrolls instead.
// A narrow tab hides its title, and the title is the only part that tells two
// pull requests apart.

export default function TabBar() {
  const tabs = useTabs((state) => state.tabs);
  const activeId = useTabs((state) => state.activeId);
  const activateTab = useTabs((state) => state.activateTab);
  const closeTab = useTabs((state) => state.closeTab);
  const closeOthers = useTabs((state) => state.closeOthers);
  const closeToRight = useTabs((state) => state.closeToRight);
  const moveTab = useTabs((state) => state.moveTab);
  const [dragged, setDragged] = useState<Tab | null>(null);
  // The sidebar is on the left of this bar, and it goes to the top of the
  // window. Thus the traffic lights are above the sidebar. This bar keeps space
  // for them only while the sidebar is hidden.
  const collapsed = useSidebarCollapsed();

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

  function menuActions(id: string) {
    return {
      availability: tabMenuAvailability(tabs, id),
      onClose: () => closeTab(id),
      onCloseOthers: () => closeOthers(id),
      onCloseToRight: () => closeToRight(id),
    };
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
      pl={collapsed ? trafficLightSpace : "2"}
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
            <TabItem
              tab={queue}
              active={activeId === queue.id}
              onSelect={activateTab}
              menuActions={menuActions(queue.id)}
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
                menuActions={menuActions(tab.id)}
              />
            ))}
          </SortableContext>
          <DragOverlay>
            {dragged && (
              <TabItem
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
