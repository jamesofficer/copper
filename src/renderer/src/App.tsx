import { Flex } from "@chakra-ui/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { PullRequest, Repository } from "../../shared/types";
import HomeSidebar from "./components/HomeSidebar";
import SettingsDialog from "./components/SettingsDialog";
import TabBar from "./components/TabBar/TabBar";
import { hotkeys, tabIndexHotkeys } from "./lib/hotkeys";
import {
  clearRecentPullRequests,
  listRecentPullRequests,
  recordRecentPullRequest,
} from "./lib/recentPrs";
import type { RepositoryDestination } from "./lib/repositoryDestination";
import { toggleSidebar, useSidebarCollapsed } from "./lib/sidebarCollapsed";
import type { OpenLocalChangesArgs, ReviewTab } from "./lib/tabs/tabs";
import { useTabs } from "./lib/tabs/useTabs";
import { useRepositoryActions } from "./lib/useRepositoryActions";
import LocalChanges from "./screens/LocalChanges/LocalChanges";
import RepoIssues from "./screens/RepoIssues/RepoIssues";
import Review from "./screens/Review";
import Welcome from "./screens/Welcome";

export default function App() {
  const queryClient = useQueryClient();
  // Which repository the queue tab shows. There is one queue tab, so this is
  // app state and not tab state. The user asked for one queue and not one per
  // repository: the win is a quick move between repositories, and a row of
  // near-identical queue tabs works against that.
  const [activePath, setActivePath] = useState<string | null>(null);
  // Clicking a pull request in the queue shows its Overview in a panel beside
  // the list. The button in that panel opens the pull request in a tab.
  const [preview, setPreview] = useState<PullRequest | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recent, setRecent] = useState(() => listRecentPullRequests());

  const collapsed = useSidebarCollapsed();
  const repos = useRepositoryActions(activePath, setActivePath);

  const tabs = useTabs((state) => state.tabs);
  const activeId = useTabs((state) => state.activeId);
  const openTab = useTabs((state) => state.openPullRequest);
  const openRepoIssuesTab = useTabs((state) => state.openRepoIssues);
  const openLocalChangesTab = useTabs((state) => state.openLocalChanges);
  const openQueue = useTabs((state) => state.openQueue);
  const closeTab = useTabs((state) => state.closeTab);
  const activateOffset = useTabs((state) => state.activateOffset);
  const setPrUi = useTabs((state) => state.setPrUi);
  const setRepoIssuesUi = useTabs((state) => state.setRepoIssuesUi);

  // The store keeps the active id inside the row, so this always finds a tab.
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  useHotkey(hotkeys.toggleSidebar, () => toggleSidebar(), {
    meta: { name: "Toggle sidebar" },
  });
  useHotkey(hotkeys.closeTab, () => closeTab(activeId), {
    meta: { name: "Close tab" },
  });
  useHotkey(hotkeys.nextTab, () => activateOffset(1), {
    meta: { name: "Next tab" },
  });
  useHotkey(hotkeys.previousTab, () => activateOffset(-1), {
    meta: { name: "Previous tab" },
  });

  function openPullRequest(pr: PullRequest, tab: ReviewTab = "overview") {
    recordRecentPullRequest(pr);
    setRecent(listRecentPullRequests());
    // Point the queue tab at the repository of this pull request, so the queue
    // shows the right list after the user goes back to it. A sidebar list can
    // cross repositories, so the pull request decides.
    const repositories = queryClient.getQueryData<Repository[]>([
      "repositories",
    ]);
    const match = repositories?.find((repo) => repo.slug === pr.repo);
    if (match) setActivePath(match.path);
    // Start the repository warm-up. The Overview may read a cache that
    // peekPullRequest filled, and that call does no warm-up.
    void window.api.getPullRequest(pr.repo, pr.number).catch(() => {});
    openTab(pr, tab);
  }

  function openRepoIssues(repo: Repository) {
    setActivePath(repo.path);
    setPreview(null);
    openRepoIssuesTab(repo);
  }

  function openWorktree(args: OpenLocalChangesArgs) {
    setActivePath(args.repoPath);
    setPreview(null);
    openLocalChangesTab(args);
  }

  // A repository is the subject of the queue, so this shows the queue tab. It
  // closes no tabs. A reviewer who opens a second repository still has the pull
  // requests of the first one open, and that is the point of the tabs.
  function selectRepo(path: string) {
    setActivePath(path);
    setPreview(null);
    openQueue();
    // Picking a repository is a deliberate "show me what is open here", so the
    // list is always read again. The cached list can be a minute old
    // (staleTime), or a whole session old, because the app stores it.
    const slug = repos.repositories?.find((repo) => repo.path === path)?.slug;
    if (slug) {
      void queryClient.invalidateQueries({ queryKey: ["pullRequests", slug] });
    }
  }

  function clearRecent() {
    clearRecentPullRequests();
    setRecent([]);
  }

  // Nothing picked yet falls back to the first repository, so the queue always
  // has something to show.
  const activeRepo =
    repos.repositories?.find((repo) => repo.path === activePath) ??
    repos.repositories?.[0] ??
    null;
  const activeRepositoryDestination: RepositoryDestination =
    active?.kind === "queue" && activeRepo
      ? { kind: "pullRequests", repoPath: activeRepo.path }
      : active?.kind === "repoIssues"
        ? { kind: "repoIssues", repoPath: active.repo.path }
        : active?.kind === "localChanges"
          ? {
              kind: "localChanges",
              repoPath: active.repoPath,
              worktreePath: active.worktreePath,
            }
          : null;

  return (
    <Flex h="100vh" minH="0">
      {!collapsed && (
        <HomeSidebar
          repositories={repos.repositories}
          reposPending={repos.reposPending}
          activePath={
            active?.kind === "repoIssues"
              ? active.repo.path
              : active?.kind === "localChanges"
                ? active.repoPath
                : (activeRepo?.path ?? null)
          }
          activeRepositoryDestination={activeRepositoryDestination}
          onSelectRepo={selectRepo}
          onOpenRepoIssues={openRepoIssues}
          onOpenLocalChanges={openWorktree}
          onAddRepo={repos.addRepository}
          onRemoveRepo={repos.removeRepository}
          onReorderRepos={repos.reorderRepositories}
          recent={recent}
          onClearRecent={clearRecent}
          openPr={active?.kind === "pr" ? active.pr : null}
          onSelectPullRequest={openPullRequest}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      <Flex direction="column" flex="1" minW="0" minH="0">
        <TabBar />

        {active?.kind === "pr" ? (
          <Review
            // Keyed by tab, so two pull requests never share the state inside
            // the screen. Only one tab is in the DOM for now.
            key={active.id}
            pr={active.pr}
            tab={active.ui.tab}
            onTabChange={(tab) => setPrUi(active.id, { tab })}
          />
        ) : active?.kind === "repoIssues" ? (
          <RepoIssues
            key={active.id}
            tab={active}
            onUiChange={(patch) => setRepoIssuesUi(active.id, patch)}
            onAddRepo={repos.addRepository}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        ) : active?.kind === "localChanges" ? (
          <LocalChanges
            key={active.id}
            tab={active}
            repo={
              repos.repositories?.find(
                (repo) => repo.path === active.repoPath,
              ) ?? null
            }
            onOpenWorktree={openWorktree}
            onAddRepo={repos.addRepository}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        ) : (
          // Welcome gives a row of panels, so it needs a row to sit in.
          <Flex flex="1" minW="0" minH="0">
            <Welcome
              repositories={repos.repositories}
              reposPending={repos.reposPending}
              activeRepo={activeRepo}
              onAddRepo={repos.addRepository}
              onSelect={openPullRequest}
              preview={preview}
              onPreviewChange={setPreview}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </Flex>
        )}
      </Flex>

      {/* One component for each shortcut, because a hook must not run inside a
          loop. The list has a fixed length, so the order never changes. */}
      {tabIndexHotkeys.map((hotkey, index) => (
        <TabIndexHotkey key={hotkey} hotkey={hotkey} index={index} />
      ))}

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Flex>
  );
}

// Cmd+1 to Cmd+9. The last one selects the last tab, whatever the count is.
function TabIndexHotkey({
  hotkey,
  index,
}: {
  hotkey: (typeof tabIndexHotkeys)[number];
  index: number;
}) {
  const activateIndex = useTabs((state) => state.activateIndex);
  useHotkey(hotkey, () => activateIndex(index), {
    meta: { name: `Select tab ${index + 1}` },
  });
  return null;
}
