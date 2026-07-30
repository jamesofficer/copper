import { Flex } from "@chakra-ui/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { PullRequest, Repository } from "../../shared/types";
import HomeSidebar from "./components/HomeSidebar";
import SettingsDialog from "./components/SettingsDialog";
import { hotkeys } from "./lib/hotkeys";
import {
  clearRecentPullRequests,
  listRecentPullRequests,
  recordRecentPullRequest,
} from "./lib/recentPrs";
import { toggleSidebar, useSidebarCollapsed } from "./lib/sidebarCollapsed";
import { useRepositoryActions } from "./lib/useRepositoryActions";
import Review from "./screens/Review";
import Welcome from "./screens/Welcome";

export default function App() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<PullRequest | null>(null);
  // Lives here (not in Welcome) so it survives leaving the home screen for a
  // PR and coming back.
  const [activePath, setActivePath] = useState<string | null>(null);
  // Clicking a PR on the home screen previews its Overview in a right panel;
  // the panel's "View PR" button opens the full review screen.
  const [preview, setPreview] = useState<PullRequest | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recent, setRecent] = useState(() => listRecentPullRequests());

  const collapsed = useSidebarCollapsed();
  const repos = useRepositoryActions(activePath, setActivePath);

  // Cmd+B / Ctrl+B hides and shows the sidebar. Registered here because the
  // sidebar itself is gone half the time.
  useHotkey(hotkeys.toggleSidebar, () => toggleSidebar(), {
    meta: { name: "Toggle sidebar" },
  });

  // Nothing picked yet falls back to the first repo, so the home screen always
  // has something to show.
  const activeRepo =
    repos.repositories?.find((repo) => repo.path === activePath) ??
    repos.repositories?.[0] ??
    null;

  function openPullRequest(pr: PullRequest) {
    recordRecentPullRequest(pr);
    setRecent(listRecentPullRequests());
    // Remember which repo this PR belongs to so returning home lands on it,
    // even when the PR was opened from a cross-repo sidebar list.
    const repositories = queryClient.getQueryData<Repository[]>([
      "repositories",
    ]);
    const match = repositories?.find((repo) => repo.slug === pr.repo);
    if (match) setActivePath(match.path);
    // Kick off the repo warm-up. The Overview tab's query may be served from
    // a cache filled via peekPullRequest, which skips warm-up.
    void window.api.getPullRequest(pr.repo, pr.number).catch(() => {});
    setSelected(pr);
  }

  function clearRecent() {
    clearRecentPullRequests();
    setRecent([]);
  }

  return (
    <Flex h="100vh" minH="0">
      {!collapsed && (
        <HomeSidebar
          repositories={repos.repositories}
          reposPending={repos.reposPending}
          activePath={activeRepo?.path ?? null}
          onSelectRepo={setActivePath}
          onAddRepo={repos.addRepository}
          onRemoveRepo={repos.removeRepository}
          onReorderRepos={repos.reorderRepositories}
          recent={recent}
          onClearRecent={clearRecent}
          openPr={selected}
          onSelectPullRequest={openPullRequest}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {selected ? (
        <Review pr={selected} onBack={() => setSelected(null)} />
      ) : (
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
      )}

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Flex>
  );
}
