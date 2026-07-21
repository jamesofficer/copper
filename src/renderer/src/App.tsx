import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { PullRequest, Repository } from "../../shared/types";
import { recordRecentPullRequest } from "./lib/recentPrs";
import Review from "./screens/Review";
import Welcome from "./screens/Welcome";

export default function App() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<PullRequest | null>(null);
  // Lives here (not in Welcome) so it survives leaving the home screen for a
  // PR and coming back.
  const [activePath, setActivePath] = useState<string | null>(null);

  function openPullRequest(pr: PullRequest) {
    recordRecentPullRequest(pr);
    // Remember which repo this PR belongs to so returning home lands on it,
    // even when the PR was opened from a cross-repo sidebar list.
    const repos = queryClient.getQueryData<Repository[]>(["repositories"]);
    const match = repos?.find((repo) => repo.slug === pr.repo);
    if (match) setActivePath(match.path);
    // Kick off the repo warm-up. The Overview tab's query may be served from
    // a cache filled via peekPullRequest, which skips warm-up.
    void window.api.getPullRequest(pr.repo, pr.number).catch(() => {});
    setSelected(pr);
  }

  if (selected) {
    return <Review pr={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <Welcome
      onSelect={openPullRequest}
      activePath={activePath}
      onActivePathChange={setActivePath}
    />
  );
}
