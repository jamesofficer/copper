import {
  Box,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Separator,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  LuFolderPlus,
  LuGitPullRequest,
  LuSettings,
  LuTrash2,
} from "react-icons/lu";
import type { PullRequest, Repository } from "../../../shared/types";
import { type RecentPullRequest, timeAgo } from "../lib/recentPrs";
import { scrollbar } from "../lib/scrollbar";
import CommentCountBadge from "./CommentCountBadge";
import RepositoryList from "./RepositoryList";
import UserAvatar from "./UserAvatar";

interface Props {
  repositories: Repository[] | undefined;
  reposPending: boolean;
  activePath: string | null;
  onSelectRepo(path: string): void;
  onAddRepo(): void;
  onRemoveRepo(path: string): void;
  onReorderRepos(repositories: Repository[]): void;
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
  onReorderRepos,
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

  const myPullRequestsQuery = useQuery({
    queryKey: ["myPullRequests"],
    queryFn: () => window.api.listMyPullRequests(),
  });
  const myPullRequests = myPullRequestsQuery.data;

  const openPrCountsQuery = useQuery({
    queryKey: ["openPrCounts"],
    queryFn: () => window.api.getOpenPullRequestCounts(),
  });

  return (
    <Flex
      direction="column"
      w="72"
      flexShrink="0"
      minH="0"
      borderRightWidth="1px"
    >
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
            <RepositoryList
              repositories={repositories}
              activePath={activePath}
              openPrCounts={openPrCountsQuery.data}
              onSelectRepo={onSelectRepo}
              onRemoveRepo={onRemoveRepo}
              onReorder={onReorderRepos}
            />
          )}
        </Section>

        <SectionDivider />

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
                leading={
                  <UserAvatar
                    username={pr.author}
                    fallback={<LuGitPullRequest />}
                  />
                }
                meta={<CommentCountBadge count={pr.comments} />}
              />
            ))
          )}
        </Section>

        <SectionDivider />

        <Section title="My pull requests">
          {myPullRequestsQuery.isPending ? (
            <Spinner size="sm" color="fg.muted" alignSelf="center" my="2" />
          ) : myPullRequestsQuery.isError ? (
            <SectionNote>Couldn’t load your pull requests.</SectionNote>
          ) : !myPullRequests || myPullRequests.length === 0 ? (
            <SectionNote>No open pull requests of yours.</SectionNote>
          ) : (
            myPullRequests.map((pr) => (
              <PullRequestRow
                key={`${pr.repo}#${pr.number}`}
                pr={pr}
                onSelect={onSelectPullRequest}
                meta={<CommentCountBadge count={pr.comments} />}
              />
            ))
          )}
        </Section>

        <SectionDivider />

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
                leading={
                  <UserAvatar
                    username={pr.author}
                    fallback={<LuGitPullRequest />}
                  />
                }
                meta={<Text color="fg.muted">{timeAgo(pr.viewedAt)}</Text>}
              />
            ))
          )}
        </Section>
      </Stack>

      <Stack gap="1" p="2" borderTopWidth="1px" flexShrink="0">
        <SidebarAction
          icon={<LuFolderPlus />}
          label="Add repository"
          onClick={onAddRepo}
        />
        <SidebarAction
          icon={<LuSettings />}
          label="Settings"
          onClick={onOpenSettings}
        />
      </Stack>
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

// Stretches edge to edge by cancelling the section stack's horizontal padding.
function SectionDivider() {
  return <Separator mx="-2" />;
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
  // Replaces the default PR icon (e.g. the author's avatar).
  leading?: ReactNode;
  onSelect(pr: PullRequest): void;
}

function PullRequestRow({ pr, meta, leading, onSelect }: PullRequestRowProps) {
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
      {leading ?? (
        <Icon size="sm" color="fg.muted" flexShrink="0">
          <LuGitPullRequest />
        </Icon>
      )}
      <Text fontSize="sm" truncate flex="1" textAlign="left">
        {pr.title}
      </Text>
      <Box flexShrink="0" fontFamily="mono" fontSize="xs">
        {meta}
      </Box>
    </HStack>
  );
}
