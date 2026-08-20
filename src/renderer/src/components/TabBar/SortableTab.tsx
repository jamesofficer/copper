import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Tab } from "../../lib/tabs/tabs";
import type { TabMenuActions } from "./TabContextMenu";
import TabItem from "./TabItem";

// A tab that the user can drag. It adds the drag behaviour to TabItem and
// nothing else. The queue tab does not use this component, because it cannot
// move.

interface Props {
  tab: Tab;
  active: boolean;
  onSelect(id: string): void;
  onClose(id: string): void;
  menuActions: TabMenuActions;
}

export default function SortableTab({
  tab,
  active,
  onSelect,
  onClose,
  menuActions,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  return (
    <TabItem
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
      menuActions={menuActions}
    />
  );
}
