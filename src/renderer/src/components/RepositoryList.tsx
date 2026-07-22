import { HStack, Icon, IconButton, Text } from "@chakra-ui/react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LuFolderGit2, LuTrash2 } from "react-icons/lu";
import type { Repository } from "../../../shared/types";

interface Props {
  repositories: Repository[];
  activePath: string | null;
  onSelectRepo(path: string): void;
  onRemoveRepo(path: string): void;
  onReorder(repositories: Repository[]): void;
}

// The sidebar's repository rows, drag-sortable via dnd-kit.
export default function RepositoryList({
  repositories,
  activePath,
  onSelectRepo,
  onRemoveRepo,
  onReorder,
}: Props) {
  // Drag only starts after 4px of movement, so plain clicks still select.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
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
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
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
            onSelect={onSelectRepo}
            onRemove={onRemoveRepo}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

interface RowProps {
  repo: Repository;
  selected: boolean;
  onSelect(path: string): void;
  onRemove(path: string): void;
}

function RepositoryRow({ repo, selected, onSelect, onRemove }: RowProps) {
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
      bg={selected ? "bg.emphasized" : undefined}
      _hover={selected ? undefined : { bg: "bg.subtle" }}
      opacity={isDragging ? 0.6 : undefined}
      zIndex={isDragging ? 1 : undefined}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: "none",
      }}
      {...attributes}
      {...listeners}
    >
      <HStack
        as="button"
        flex="1"
        minW="0"
        gap="2"
        px="2"
        py="1.5"
        cursor="pointer"
        title={repo.path}
        onClick={() => onSelect(repo.path)}
      >
        <Icon size="sm" color="fg.muted" flexShrink="0">
          <LuFolderGit2 />
        </Icon>
        <Text fontSize="sm" fontFamily="mono" truncate>
          {repo.slug?.split("/")[1] ?? repo.name}
        </Text>
      </HStack>
      <IconButton
        aria-label="Remove repository"
        size="2xs"
        variant="ghost"
        color="fg.muted"
        mr="1"
        opacity="0"
        _groupHover={{ opacity: 1 }}
        _focusVisible={{ opacity: 1 }}
        onClick={() => onRemove(repo.path)}
      >
        <LuTrash2 />
      </IconButton>
    </HStack>
  );
}
