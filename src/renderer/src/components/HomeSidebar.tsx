import {
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
  LuPanelLeftClose,
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
import { hotkeyHint, hotkeys } from "../lib/hotkeys";
import { type RecentPullRequest, timeAgo } from "../lib/recentPrs";
import { scrollbar } from "../lib/scrollbar";
import { setSidebarCollapsed } from "../lib/sidebarCollapsed";
import { setSectionOpen, useCollapsedSections } from "../lib/sidebarSections";
import { sidebarHover } from "../lib/sidebarStyles";
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
  // The PR on the review screen, marked in the lists so you can see where you
  // are while jumping between them. Null on the home screen.
  openPr: PullRequest | null;
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
  openPr,
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

  function isOpenPr(pr: PullRequest): boolean {
    return openPr?.repo === pr.repo && openPr?.number === pr.number;
  }

  // Hidden keys are matched against the live list, so a request that has since
  // been merged or closed stops being counted without any cleanup pass.
  const hidden = new Set(useHiddenReviewRequests());
  const visibleRequests = (reviewRequests ?? []).filter(
    (pr) => !hidden.has(reviewRequestKey(pr)),
  );
  const hiddenRequestPrs = (reviewRequests ?? []).filter((pr) =>
    hidden.has(reviewRequestKey(pr)),
  );

  // The sidebar sits recessed against the main column: a translucent black
  // darkens whatever the current mode's page background is, so one rule covers
  // both modes and it stays clear of the rows' hover colour.
  return (
    <Flex
      direction="column"
      w="72"
      flexShrink="0"
      minH="0"
      borderRightWidth="1px"
      bg="black/8"
      _dark={{ bg: "black/40" }}
    >
      {/* The window's traffic lights are drawn over this corner, so the app's
          own buttons sit at the far end of the bar. Its height matches the main
          column's header so the two line up, and the bar itself drags the
          window. */}
      <HStack
        h={titleBarHeight}
        flexShrink="0"
        borderBottomWidth="1px"
        justifyContent="flex-end"
        gap="1"
        pr="2"
        css={dragRegion}
      >
        <IconButton
          aria-label="Add repository"
          title="Add repository"
          size="xs"
          variant="ghost"
          color="fg.muted"
          onClick={onAddRepo}
        >
          <LuFolderPlus />
        </IconButton>
        <IconButton
          aria-label="Settings"
          title="Settings"
          size="xs"
          variant="ghost"
          color="fg.muted"
          onClick={onOpenSettings}
        >
          <LuSettings />
        </IconButton>
        <IconButton
          aria-label="Hide sidebar"
          title={`Hide sidebar (${hotkeyHint(hotkeys.toggleSidebar)})`}
          size="xs"
          variant="ghost"
          color="fg.muted"
          onClick={() => setSidebarCollapsed(true)}
        >
          <LuPanelLeftClose />
        </IconButton>
      </HStack>

      <Stack
        flex="1"
        minH="0"
        overflowY="auto"
        gap="5"
        px="2"
        pt="4"
        pb="2"
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
                selected={isOpenPr(pr)}
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
          <AnalyzedSidebarList openPr={openPr} onSelect={onSelectPullRequest} />
        </Section>

        <SectionDivider />

        <Section
          id="reviewRequests"
          title="Review requests"
          count={visibleRequests.length}
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
                selected={isOpenPr(pr)}
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
                selected={isOpenPr(pr)}
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
          {hiddenRequestPrs.length > 0 && (
            <Button
              size="2xs"
              variant="ghost"
              color="fg.muted"
              justifyContent="flex-start"
              px="2"
              _hover={sidebarHover}
              onClick={() => setShowHidden(!showHidden)}
            >
              {showHidden
                ? "Hide hidden"
                : `Show hidden (${hiddenRequestPrs.length})`}
            </Button>
          )}
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
                selected={isOpenPr(pr)}
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
                selected={isOpenPr(pr)}
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
    </Flex>
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
        <Collapsible.Trigger
          flex="1"
          minW="0"
          cursor="pointer"
          color="fg.muted"
          _hover={{ color: "fg" }}
        >
          <HStack gap="1" color="inherit">
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
              <Text fontSize="xs" letterSpacing="wider">
                ({count})
              </Text>
            )}
          </HStack>
        </Collapsible.Trigger>
        {action}
      </HStack>
      <Collapsible.Content>
        <Stack gap="1" pt="2.5">
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
