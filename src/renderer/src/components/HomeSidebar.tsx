import {
  Box,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  LuFolderGit2,
  LuFolderPlus,
  LuGitPullRequest,
  LuSettings,
  LuTrash2,
} from "react-icons/lu";
import type { PullRequest, Repository } from "../../../shared/types";
import { type RecentPullRequest, timeAgo } from "../lib/recentPrs";
import { scrollbar } from "../lib/scrollbar";

interface Props {
  repositories: Repository[] | undefined;
  reposPending: boolean;
  activePath: string | null;
  onSelectRepo(path: string): void;
  onAddRepo(): void;
  onRemoveRepo(path: string): void;
  recent: RecentPullRequest[];
  onClearRecent(): void;
  onSelectPullRequest(pr: PullRequest): void;
  onOpenSettings(): void;
}

export default function HomeSidebar({
  repositories,
  reposPending,
  activePath,
  onSelectRepo,
  onAddRepo,
  onRemoveRepo,
  recent,
  onClearRecent,
  onSelectPullRequest,
  onOpenSettings,
}: Props) {
  const reviewRequestsQuery = useQuery({
    queryKey: ["reviewRequests"],
    queryFn: () => window.api.listReviewRequestedPullRequests(),
  });
  const reviewRequests = reviewRequestsQuery.data;

  return (
    <Flex
      direction="column"
      w="72"
      flexShrink="0"
      minH="0"
      borderRightWidth="1px"
    >
      <Box px="2" pt="2" pb="1" flexShrink="0">
        <SidebarAction
          icon={<LuFolderPlus />}
          label="Add repository"
          onClick={onAddRepo}
        />
      </Box>

      <Stack
        flex="1"
        minH="0"
        overflowY="auto"
        gap="5"
        px="2"
        py="2"
        css={scrollbar}
      >
        <Section title="Repositories">
          {reposPending ? (
            <Spinner size="sm" color="fg.muted" alignSelf="center" my="2" />
          ) : !repositories || repositories.length === 0 ? (
            <SectionNote>
              No repositories yet. Add a local git repository to get started.
            </SectionNote>
          ) : (
            repositories.map((repo) => {
              const selected = repo.path === activePath;
              return (
                <HStack
                  key={repo.path}
                  className="group"
                  gap="0"
                  rounded="md"
                  bg={selected ? "bg.emphasized" : undefined}
                  _hover={selected ? undefined : { bg: "bg.subtle" }}
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
                    onClick={() => onSelectRepo(repo.path)}
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
                    onClick={() => onRemoveRepo(repo.path)}
                  >
                    <LuTrash2 />
                  </IconButton>
                </HStack>
              );
            })
          )}
        </Section>

        <Section title="Review requests">
          {reviewRequestsQuery.isPending ? (
            <Spinner size="sm" color="fg.muted" alignSelf="center" my="2" />
          ) : reviewRequestsQuery.isError ? (
            <SectionNote>Couldn’t load review requests.</SectionNote>
          ) : !reviewRequests || reviewRequests.length === 0 ? (
            <SectionNote>No reviews waiting on you.</SectionNote>
          ) : (
            reviewRequests.map((pr) => (
              <PullRequestRow
                key={`${pr.repo}#${pr.number}`}
                pr={pr}
                onSelect={onSelectPullRequest}
                meta={
                  <HStack gap="1.5">
                    <Text color="green.fg">+{pr.additions}</Text>
                    <Text color="red.fg">−{pr.deletions}</Text>
                  </HStack>
                }
              />
            ))
          )}
        </Section>

        <Section
          title="Recently viewed"
          action={
            recent.length > 0 && (
              <IconButton
                aria-label="Clear history"
                size="2xs"
                variant="ghost"
                color="fg.muted"
                onClick={onClearRecent}
              >
                <LuTrash2 />
              </IconButton>
            )
          }
        >
          {recent.length === 0 ? (
            <SectionNote>Pull requests you open will show up here.</SectionNote>
          ) : (
            recent.map((pr) => (
              <PullRequestRow
                key={`${pr.repo}#${pr.number}`}
                pr={pr}
                onSelect={onSelectPullRequest}
                meta={<Text color="fg.muted">{timeAgo(pr.viewedAt)}</Text>}
              />
            ))
          )}
        </Section>
      </Stack>

      <Box p="2" borderTopWidth="1px" flexShrink="0">
        <SidebarAction
          icon={<LuSettings />}
          label="Settings"
          onClick={onOpenSettings}
        />
      </Box>
    </Flex>
  );
}

interface SidebarActionProps {
  icon: ReactNode;
  label: string;
  onClick(): void;
}

function SidebarAction({ icon, label, onClick }: SidebarActionProps) {
  return (
    <HStack
      as="button"
      w="full"
      gap="2"
      px="2"
      py="1.5"
      rounded="md"
      cursor="pointer"
      _hover={{ bg: "bg.subtle" }}
      onClick={onClick}
    >
      <Icon size="sm" color="fg.muted">
        {icon}
      </Icon>
      <Text fontSize="sm">{label}</Text>
    </HStack>
  );
}

interface SectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

function Section({ title, action, children }: SectionProps) {
  return (
    <Stack gap="1">
      <HStack justifyContent="space-between" px="2" minH="5">
        <Heading
          size="xs"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
        >
          {title}
        </Heading>
        {action}
      </HStack>
      {children}
    </Stack>
  );
}

interface SectionNoteProps {
  children: ReactNode;
}

function SectionNote({ children }: SectionNoteProps) {
  return (
    <Text fontSize="xs" color="fg.muted" px="2">
      {children}
    </Text>
  );
}

interface PullRequestRowProps {
  pr: PullRequest;
  meta: ReactNode;
  onSelect(pr: PullRequest): void;
}

function PullRequestRow({ pr, meta, onSelect }: PullRequestRowProps) {
  return (
    <HStack
      as="button"
      gap="2"
      px="2"
      py="1.5"
      rounded="md"
      cursor="pointer"
      _hover={{ bg: "bg.subtle" }}
      title={`${pr.repo}#${pr.number} — ${pr.title}`}
      onClick={() => onSelect(pr)}
    >
      <Icon size="sm" color="fg.muted" flexShrink="0">
        <LuGitPullRequest />
      </Icon>
      <Text fontSize="sm" truncate flex="1" textAlign="left">
        {pr.title}
      </Text>
      <Box flexShrink="0" fontFamily="mono" fontSize="xs">
        {meta}
      </Box>
    </HStack>
  );
}
