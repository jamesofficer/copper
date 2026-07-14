import { useState } from "react";
import type { PullRequest } from "../../shared/types";
import { recordRecentPullRequest } from "./lib/recentPrs";
import Review from "./screens/Review";
import Welcome from "./screens/Welcome";

export default function App() {
  const [selected, setSelected] = useState<PullRequest | null>(null);

  function openPullRequest(pr: PullRequest) {
    recordRecentPullRequest(pr);
    setSelected(pr);
  }

  if (selected) {
    return <Review pr={selected} onBack={() => setSelected(null)} />;
  }

  return <Welcome onSelect={openPullRequest} />;
}
