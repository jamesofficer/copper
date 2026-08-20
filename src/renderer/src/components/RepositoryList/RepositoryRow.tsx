import { HStack, Icon, IconButton, Stack, Text } from "@chakra-ui/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LuChevronRight, LuFolderGit2, LuTrash2 } from "react-icons/lu";
import type { RepoCounts, Repository } from "../../../../shared/types";
import type { RepositoryDestination } from "../../lib/repositoryDestination";
import { sidebarHover, sidebarSelected } from "../../lib/sidebarStyles";
import type { OpenLocalChangesArgs } from "../../lib/tabs/tabs";
import UserAvatar from "../UserAvatar";
import RepositoryDestinations from "./RepositoryDestinations";

interface Props {
  repo: Repository;
  selected: boolean;
  open: boolean;
  activeDestination: RepositoryDestination;
  counts: RepoCounts | undefined;
  onOpenChange(open: boolean): void;
  onSelect(path: string): void;
  onOpenIssues(repo: Repository): void;
  onOpenLocalChanges(args: OpenLocalChangesArgs): void;
  onRemove(path: string): void;
}

export default function RepositoryRow({
  repo,
  selected,
  open,
  activeDestination,
  counts,
  onOpenChange,
  onSelect,
  onOpenIssues,
  onOpenLocalChanges,
  onRemove,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: repo.path });

  return (
    <Stack
      ref={setNodeRef}
      gap="0.5"
      opacity={isDragging ? 0.35 : undefined}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <HStack
        className="group"
        gap="0"
        rounded="md"
        css={selected ? sidebarSelected : undefined}
        _hover={selected ? undefined : sidebarHover}
        style={{ touchAction: "none" }}
        {...attributes}
        {...listeners}
      >
        <RepositoryRowContent
          repo={repo}
          selected={selected}
          open={open}
          onOpenChange={onOpenChange}
          onSelect={onSelect}
          onRemove={onRemove}
        />
      </HStack>
      {open && (
        <RepositoryDestinations
          repo={repo}
          counts={counts}
          active={activeDestination}
          onSelectRepo={onSelect}
          onOpenIssues={onOpenIssues}
          onOpenLocalChanges={onOpenLocalChanges}
        />
      )}
    </Stack>
  );
}

const revealed = ".group:hover &, .group:has(:focus-visible) &";

interface ContentProps {
  repo: Repository;
  selected: boolean;
  open: boolean;
  // Actions are absent on the drag copy because it is visual only.
  onOpenChange?(open: boolean): void;
  onSelect?(path: string): void;
  onRemove?(path: string): void;
}

export function RepositoryRowContent({
  repo,
  selected,
  open,
  onOpenChange,
  onSelect,
  onRemove,
}: ContentProps) {
  const owner = repo.slug?.split("/")[0];
  return (
    <>
      <IconButton
        aria-label={`${open ? "Collapse" : "Expand"} ${repo.name}`}
        size="2xs"
        variant="ghost"
        color="fg.muted"
        flexShrink="0"
        ml="1"
        onClick={onOpenChange ? () => onOpenChange(!open) : undefined}
      >
        <LuChevronRight
          style={{ transform: open ? "rotate(90deg)" : undefined }}
        />
      </IconButton>
      <HStack
        as="button"
        flex="1"
        minW="0"
        gap="2"
        px="1"
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
      {onRemove && (
        <IconButton
          aria-label="Remove repository"
          size="2xs"
          variant="outline"
          borderColor={selected ? "border.emphasized" : undefined}
          flexShrink="0"
          mr="2"
          opacity="0"
          css={{ [revealed]: { opacity: 1 } }}
          onClick={() => onRemove(repo.path)}
        >
          <LuTrash2 />
        </IconButton>
      )}
    </>
  );
}
