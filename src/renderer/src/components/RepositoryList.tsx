import {
  Badge,
  Center,
  HStack,
  Icon,
  IconButton,
  Text,
} from "@chakra-ui/react";
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
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { LuFolderGit2, LuTrash2 } from "react-icons/lu";
import type { Repository } from "../../../shared/types";
import { sidebarHover, sidebarSelected } from "../lib/sidebarStyles";
import UserAvatar from "./UserAvatar";

interface Props {
  repositories: Repository[];
  activePath: string | null;
  // Open-PR count per slug — shown at the row's right edge when known.
  openPrCounts: Record<string, number> | undefined;
  onSelectRepo(path: string): void;
  onRemoveRepo(path: string): void;
  onReorder(repositories: Repository[]): void;
}

// The sidebar's repository rows, drag-sortable via dnd-kit. The dragged row
// is rendered in a DragOverlay so dropping animates smoothly into place; the
// row left behind dims to act as the placeholder.
export default function RepositoryList({
  repositories,
  activePath,
  openPrCounts,
  onSelectRepo,
  onRemoveRepo,
  onReorder,
}: Props) {
  const [dragged, setDragged] = useState<Repository | null>(null);

  // Drag only starts after 4px of movement, so plain clicks still select.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    setDragged(
      repositories.find((repo) => repo.path === event.active.id) ?? null,
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragged(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = repositories.findIndex((repo) => repo.path === active.id);
    const to = repositories.findIndex((repo) => repo.path === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(repositories, from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragged(null)}
    >
      <SortableContext
        items={repositories.map((repo) => repo.path)}
        strategy={verticalListSortingStrategy}
      >
        {repositories.map((repo) => (
          <RepositoryRow
            key={repo.path}
            repo={repo}
            selected={repo.path === activePath}
            count={repo.slug ? openPrCounts?.[repo.slug] : undefined}
            onSelect={onSelectRepo}
            onRemove={onRemoveRepo}
          />
        ))}
      </SortableContext>
      <DragOverlay>
        {dragged && (
          <HStack
            className="group"
            gap="0"
            rounded="md"
            bg={dragged.path === activePath ? "bg.emphasized" : "bg.panel"}
            shadow="md"
            cursor="grabbing"
          >
            <RowContent
              repo={dragged}
              selected={dragged.path === activePath}
              count={dragged.slug ? openPrCounts?.[dragged.slug] : undefined}
            />
          </HStack>
        )}
      </DragOverlay>
    </DndContext>
  );
}

interface RowProps {
  repo: Repository;
  selected: boolean;
  count: number | undefined;
  onSelect(path: string): void;
  onRemove(path: string): void;
}

function RepositoryRow({
  repo,
  selected,
  count,
  onSelect,
  onRemove,
}: RowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: repo.path });

  return (
    <HStack
      ref={setNodeRef}
      className="group"
      gap="0"
      rounded="md"
      css={selected ? sidebarSelected : undefined}
      _hover={selected ? undefined : sidebarHover}
      opacity={isDragging ? 0.35 : undefined}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: "none",
      }}
      {...attributes}
      {...listeners}
    >
      <RowContent
        repo={repo}
        selected={selected}
        count={count}
        onSelect={onSelect}
        onRemove={onRemove}
      />
    </HStack>
  );
}

// The badge and the button share one slot, so one condition has to drive
// both, or they draw at once: closing a dialog (or tabbing away) hands focus
// back with the pointer elsewhere, and a hover-only rule can't see it. Same
// selectors, inverse values. :focus-visible rather than :focus-within so
// restored focus only counts when the user is actually on the keyboard.
const revealed = ".group:hover &, .group:has(:focus-visible) &";

interface RowContentProps {
  repo: Repository;
  selected: boolean;
  count: number | undefined;
  // Absent on the DragOverlay copy — it's purely visual.
  onSelect?(path: string): void;
  onRemove?(path: string): void;
}

function RowContent({
  repo,
  selected,
  count,
  onSelect,
  onRemove,
}: RowContentProps) {
  const owner = repo.slug?.split("/")[0];
  return (
    <>
      <HStack
        as="button"
        flex="1"
        minW="0"
        gap="2"
        px="2"
        py="1.5"
        cursor="pointer"
        title={repo.path}
        onClick={onSelect ? () => onSelect(repo.path) : undefined}
      >
        {owner ? (
          <UserAvatar
            username={owner}
            fallback={<LuFolderGit2 />}
            shape="rounded"
          />
        ) : (
          <Icon size="sm" color="fg.muted" flexShrink="0">
            <LuFolderGit2 />
          </Icon>
        )}
        <Text fontSize="sm" fontFamily="mono" truncate>
          {repo.slug?.split("/")[1] ?? repo.name}
        </Text>
      </HStack>
      {/* One fixed slot at the row's edge: the open-PR count, replaced by
          the remove button while the row is hovered. */}
      <Center position="relative" minW="5" h="5" mr="2" flexShrink="0">
        {count !== undefined && count > 0 && (
          <Badge
            size="xs"
            variant="surface"
            fontFamily="mono"
            css={onRemove ? { [revealed]: { opacity: 0 } } : undefined}
          >
            {count}
          </Badge>
        )}
        {onRemove && (
          <IconButton
            aria-label="Remove repository"
            size="2xs"
            variant="outline"
            // A selected row's overlay sits within a shade of the outline
            // variant's default border, which would swallow it; the next step
            // out reads in both colour modes.
            borderColor={selected ? "border.emphasized" : undefined}
            position="absolute"
            inset="0"
            opacity="0"
            css={{ [revealed]: { opacity: 1 } }}
            onClick={() => onRemove(repo.path)}
          >
            <LuTrash2 />
          </IconButton>
        )}
      </Center>
    </>
  );
}
