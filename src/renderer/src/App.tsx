import { useState } from "react";
import type { PullRequest } from "../../shared/types";
import { recordRecentPullRequest } from "./lib/recentPrs";
import Review from "./screens/Review";
import Welcome from "./screens/Welcome";

export default function App() {
  const [selected, setSelected] = useState<PullRequest | null>(null);

  function openPullRequest(pr: PullRequest) {
    recordRecentPullRequest(pr);
    // Kick off the repo warm-up. The Overview tab's query may be served from
    // a cache RecentPanel filled via peekPullRequest, which skips warm-up.
    void window.api.getPullRequest(pr.repo, pr.number).catch(() => {});
    setSelected(pr);
  }

  if (selected) {
    return <Review pr={selected} onBack={() => setSelected(null)} />;
  }

  return <Welcome onSelect={openPullRequest} />;
}
