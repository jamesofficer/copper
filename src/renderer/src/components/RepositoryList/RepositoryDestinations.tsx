import { Badge, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LuCircleDot, LuGitBranch, LuGitPullRequest } from "react-icons/lu";
import type {
  RepoCounts,
  Repository,
  Worktree,
} from "../../../../shared/types";
import { worktreesQueryOptions } from "../../lib/repoQueries";
import type { RepositoryDestination } from "../../lib/repositoryDestination";
import { sidebarHover, sidebarSelected } from "../../lib/sidebarStyles";
import { localChangesTitle } from "../../lib/tabs/tabLabel";
import type { OpenLocalChangesArgs } from "../../lib/tabs/tabs";
import { localChangeCountQueryOptions } from "../../lib/useLocalChanges";

interface Props {
  repo: Repository;
  counts: RepoCounts | undefined;
  active: RepositoryDestination;
  onSelectRepo(path: string): void;
  onOpenIssues(repo: Repository): void;
  onOpenLocalChanges(args: OpenLocalChangesArgs): void;
}

export default function RepositoryDestinations({
  repo,
  counts,
  active,
  onSelectRepo,
  onOpenIssues,
  onOpenLocalChanges,
}: Props) {
  const worktreesQuery = useQuery(worktreesQueryOptions(repo.path));
  const worktrees = worktreesQuery.data ?? [];
  const main =
    worktrees.find((worktree) => worktree.isMain) ??
    ({ path: repo.path, branch: null, isMain: true } satisfies Worktree);
  const linked = worktrees.filter((worktree) => worktree.path !== main.path);

  return (
    <Stack gap="0.5">
      <DestinationRow
        icon={<LuGitPullRequest />}
        label="Pull requests"
        count={counts?.pullRequests}
        selected={
          active?.kind === "pullRequests" && active.repoPath === repo.path
        }
        onClick={() => onSelectRepo(repo.path)}
      />
      <DestinationRow
        icon={<LuCircleDot />}
        label="Issues"
        count={counts?.issues}
        selected={
          active?.kind === "repoIssues" && active.repoPath === repo.path
        }
        onClick={() => onOpenIssues(repo)}
      />
      <WorktreeDestination
        repo={repo}
        worktree={main}
        label="Current changes"
        selected={
          active?.kind === "localChanges" &&
          active.repoPath === repo.path &&
          active.worktreePath === main.path
        }
        onOpen={onOpenLocalChanges}
      />
      {linked.map((worktree) => (
        <WorktreeDestination
          key={worktree.path}
          repo={repo}
          worktree={worktree}
          label={worktree.branch ?? folderName(worktree.path)}
          nested
          selected={
            active?.kind === "localChanges" &&
            active.repoPath === repo.path &&
            active.worktreePath === worktree.path
          }
          onOpen={onOpenLocalChanges}
        />
      ))}
    </Stack>
  );
}

function WorktreeDestination({
  repo,
  worktree,
  label,
  nested,
  selected,
  onOpen,
}: {
  repo: Repository;
  worktree: Worktree;
  label: string;
  nested?: boolean;
  selected: boolean;
  onOpen(args: OpenLocalChangesArgs): void;
}) {
  const countQuery = useQuery(localChangeCountQueryOptions(worktree.path));
  return (
    <DestinationRow
      icon={<LuGitBranch />}
      label={label}
      count={countQuery.data}
      nested={nested}
      selected={selected}
      onClick={() =>
        onOpen({
          repoPath: repo.path,
          worktreePath: worktree.path,
          title: localChangesTitle(repo.name, worktree),
        })
      }
    />
  );
}

function DestinationRow({
  icon,
  label,
  count,
  nested,
  selected,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  nested?: boolean;
  selected: boolean;
  onClick(): void;
}) {
  return (
    <HStack
      as="button"
      w="full"
      minW="0"
      gap="2"
      pl={nested ? "12" : "8"}
      pr="2"
      py="1.5"
      rounded="md"
      color={selected ? "fg" : "fg.muted"}
      css={selected ? sidebarSelected : undefined}
      _hover={selected ? undefined : sidebarHover}
      onClick={onClick}
    >
      <Icon size="xs" flexShrink="0">
        {icon}
      </Icon>
      <Text fontSize="sm" truncate>
        {label}
      </Text>
      {count !== undefined && (
        <Badge
          ml="auto"
          size="xs"
          variant="surface"
          colorPalette="gray"
          fontFamily="mono"
        >
          {count}
        </Badge>
      )}
    </HStack>
  );
}

function folderName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}
