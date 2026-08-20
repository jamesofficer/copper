import { HStack } from "@chakra-ui/react";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEffect, useState } from "react";
import type { RepoCounts, Repository } from "../../../../shared/types";
import type { RepositoryDestination } from "../../lib/repositoryDestination";
import type { OpenLocalChangesArgs } from "../../lib/tabs/tabs";
import RepositoryRow, { RepositoryRowContent } from "./RepositoryRow";

interface Props {
  repositories: Repository[];
  activePath: string | null;
  activeDestination: RepositoryDestination;
  counts: Record<string, RepoCounts> | undefined;
  onSelectRepo(path: string): void;
  onOpenIssues(repo: Repository): void;
  onOpenLocalChanges(args: OpenLocalChangesArgs): void;
  onRemoveRepo(path: string): void;
  onReorder(repositories: Repository[]): void;
}

// The repository rows are launchers and drag targets. Expanding one row shows
// its Pull Requests, Issues and worktree-specific Current Changes destinations.
export default function RepositoryList({
  repositories,
  activePath,
  activeDestination,
  counts,
  onSelectRepo,
  onOpenIssues,
  onOpenLocalChanges,
  onRemoveRepo,
  onReorder,
}: Props) {
  const [dragged, setDragged] = useState<Repository | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(activeDestination ? [activeDestination.repoPath] : []),
  );

  const activeDestinationKey = activeDestination
    ? `${activeDestination.kind}:${activeDestination.repoPath}:${
        activeDestination.kind === "localChanges"
          ? activeDestination.worktreePath
          : ""
      }`
    : "";
  const activeDestinationRepoPath = activeDestination?.repoPath ?? null;
  useEffect(() => {
    if (!activeDestinationKey || !activeDestinationRepoPath) return;
    setExpanded((current) => {
      if (current.has(activeDestinationRepoPath)) return current;
      return new Set([...current, activeDestinationRepoPath]);
    });
  }, [activeDestinationKey, activeDestinationRepoPath]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function setOpen(path: string, open: boolean) {
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.add(path);
      else next.delete(path);
      return next;
    });
  }

  function selectRepo(path: string) {
    setOpen(path, true);
    onSelectRepo(path);
  }

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
            open={expanded.has(repo.path)}
            activeDestination={activeDestination}
            counts={repo.slug ? counts?.[repo.slug] : undefined}
            onOpenChange={(open) => setOpen(repo.path, open)}
            onSelect={selectRepo}
            onOpenIssues={onOpenIssues}
            onOpenLocalChanges={onOpenLocalChanges}
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
            <RepositoryRowContent
              repo={dragged}
              selected={dragged.path === activePath}
              open={expanded.has(dragged.path)}
            />
          </HStack>
        )}
      </DragOverlay>
    </DndContext>
  );
}
