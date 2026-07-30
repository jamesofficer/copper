import {
  Box,
  Button,
  Collapsible,
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
import { type ReactNode, useState } from "react";
import {
  LuChevronRight,
  LuEye,
  LuFolderPlus,
  LuGitPullRequest,
  LuSettings,
  LuStar,
  LuTrash2,
} from "react-icons/lu";
import type { PullRequest, Repository } from "../../../shared/types";
import { removeFavourite, useFavouritePullRequests } from "../lib/favouritePrs";
import {
  reviewRequestKey,
  showReviewRequest,
  useHiddenReviewRequests,
} from "../lib/hiddenReviewRequests";
import { type RecentPullRequest, timeAgo } from "../lib/recentPrs";
import { scrollbar } from "../lib/scrollbar";
import { setSectionOpen, useCollapsedSections } from "../lib/sidebarSections";
import { dragRegion, titleBarHeight } from "../lib/titleBar";
import AnalyzedSidebarList from "./AnalyzedSidebarList";
import CommentCountBadge from "./CommentCountBadge";
import RepositoryList from "./RepositoryList";
import ReviewRequestActions from "./ReviewRequestActions";
import SidebarPullRequestRow from "./SidebarPullRequestRow";
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
  const [showHidden, setShowHidden] = useState(false);
  const favourites = useFavouritePullRequests();

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

  // Hidden keys are matched against the live list, so a request that has since
  // been merged or closed stops being counted without any cleanup pass.
  const hidden = new Set(useHiddenReviewRequests());
  const visibleRequests = (reviewRequests ?? []).filter(
    (pr) => !hidden.has(reviewRequestKey(pr)),
  );
  const hiddenRequestPrs = (reviewRequests ?? []).filter((pr) =>
    hidden.has(reviewRequestKey(pr)),
  );

  return (
    <Flex
      direction="column"
      w="72"
      flexShrink="0"
      minH="0"
      borderRightWidth="1px"
    >
      {/* Room for the window's traffic lights, which macOS draws over this
          corner. Its height matches the main column's header so the two line
          up, and it doubles as the window's drag handle. */}
      <Box
        h={titleBarHeight}
        flexShrink="0"
        borderBottomWidth="1px"
        css={dragRegion}
      />

      <Stack
        flex="1"
        minH="0"
        overflowY="auto"
        gap="5"
        px="2"
        py="2"
        css={scrollbar}
      >
        <Section
          id="repositories"
          title="Repositories"
          count={repositories?.length}
        >
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

        <Section id="favourites" title="Favourites" count={favourites.length}>
          {favourites.length === 0 ? (
            <SectionNote>Star a pull request to keep it here.</SectionNote>
          ) : (
            favourites.map((pr) => (
              <SidebarPullRequestRow
                key={`${pr.repo}#${pr.number}`}
                pr={pr}
                onSelect={onSelectPullRequest}
                leading={
                  <Icon size="sm" color="yellow.fg" flexShrink="0">
                    <LuStar fill="currentColor" />
                  </Icon>
                }
                meta={<CommentCountBadge count={pr.comments} />}
                actions={
                  <IconButton
                    aria-label="Remove from favourites"
                    title="Remove from favourites"
                    size="2xs"
                    variant="ghost"
                    color="fg.muted"
                    onClick={() => removeFavourite(pr)}
                  >
                    <LuStar />
                  </IconButton>
                }
              />
            ))
          )}
        </Section>

        <SectionDivider />

        <Section id="analysed" title="Analysed">
          <AnalyzedSidebarList onSelect={onSelectPullRequest} />
        </Section>

        <SectionDivider />

        <Section
          id="reviewRequests"
          title="Review requests"
          count={visibleRequests.length}
          action={
            hiddenRequestPrs.length > 0 && (
              <Button
                size="2xs"
                variant="ghost"
                color="fg.muted"
                onClick={() => setShowHidden(!showHidden)}
              >
                {showHidden
                  ? "Hide hidden"
                  : `Show hidden (${hiddenRequestPrs.length})`}
              </Button>
            )
          }
        >
          {reviewRequestsQuery.isPending ? (
            <Spinner size="sm" color="fg.muted" alignSelf="center" my="2" />
          ) : reviewRequestsQuery.isError ? (
            <SectionNote>Couldn’t load review requests.</SectionNote>
          ) : !reviewRequests || reviewRequests.length === 0 ? (
            <SectionNote>No reviews waiting on you.</SectionNote>
          ) : visibleRequests.length === 0 ? (
            <SectionNote>
              All {hiddenRequestPrs.length} review requests are hidden.
            </SectionNote>
          ) : (
            visibleRequests.map((pr) => (
              <SidebarPullRequestRow
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
                actions={<ReviewRequestActions pr={pr} />}
              />
            ))
          )}
          {showHidden &&
            hiddenRequestPrs.map((pr) => (
              <SidebarPullRequestRow
                key={`hidden-${pr.repo}#${pr.number}`}
                pr={pr}
                onSelect={onSelectPullRequest}
                leading={
                  <UserAvatar
                    username={pr.author}
                    fallback={<LuGitPullRequest />}
                  />
                }
                meta={
                  <Text color="fg.subtle" fontSize="xs">
                    hidden
                  </Text>
                }
                actions={
                  <IconButton
                    aria-label="Show in this list again"
                    title="Show in this list again"
                    size="2xs"
                    variant="ghost"
                    color="fg.muted"
                    onClick={() => showReviewRequest(reviewRequestKey(pr))}
                  >
                    <LuEye />
                  </IconButton>
                }
              />
            ))}
        </Section>

        <SectionDivider />

        <Section
          id="myPullRequests"
          title="My pull requests"
          count={myPullRequests?.length}
        >
          {myPullRequestsQuery.isPending ? (
            <Spinner size="sm" color="fg.muted" alignSelf="center" my="2" />
          ) : myPullRequestsQuery.isError ? (
            <SectionNote>Couldn’t load your pull requests.</SectionNote>
          ) : !myPullRequests || myPullRequests.length === 0 ? (
            <SectionNote>No open pull requests of yours.</SectionNote>
          ) : (
            myPullRequests.map((pr) => (
              <SidebarPullRequestRow
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
          id="recentlyViewed"
          title="Recently viewed"
          count={recent.length}
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
              <SidebarPullRequestRow
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
  // Identifies the section in the saved collapsed-sections list.
  id: string;
  title: string;
  // Shown beside the title so a collapsed section still says how much is in it.
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}

function Section({ id, title, count, action, children }: SectionProps) {
  const collapsed = useCollapsedSections().includes(id);

  return (
    <Collapsible.Root
      open={!collapsed}
      onOpenChange={(event) => setSectionOpen(id, event.open)}
    >
      <HStack justifyContent="space-between" px="2" minH="5" gap="1">
        <Collapsible.Trigger flex="1" minW="0" cursor="pointer">
          <HStack gap="1" color="fg.muted">
            <Collapsible.Indicator
              display="flex"
              transition="transform 0.2s"
              _open={{ transform: "rotate(90deg)" }}
            >
              <LuChevronRight size="12" />
            </Collapsible.Indicator>
            <Heading
              size="xs"
              textTransform="uppercase"
              letterSpacing="wider"
              truncate
            >
              {title}
            </Heading>
            {count !== undefined && count > 0 && (
              <Text fontSize="xs" fontFamily="mono">
                {count}
              </Text>
            )}
          </HStack>
        </Collapsible.Trigger>
        {action}
      </HStack>
      <Collapsible.Content>
        <Stack gap="1" pt="1">
          {children}
        </Stack>
      </Collapsible.Content>
    </Collapsible.Root>
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
