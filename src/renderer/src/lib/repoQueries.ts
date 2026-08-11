// The repo-scoped queries more than one place reads. Kept as options rather than
// hooks so every consumer subscribes to the same key on its own: TanStack Query
// dedupes them, so a count in the tab bar and the list it counts cost one fetch
// between them and nothing has to be drilled through props to share it.

// One fetch returns the OPEN_PULL_REQUEST_LIMIT most recently updated open PRs.
export function pullRequestsQueryOptions(slug: string | undefined) {
  return {
    queryKey: ["pullRequests", slug],
    queryFn: () => window.api.listPullRequests(slug ?? ""),
    enabled: Boolean(slug),
  } as const;
}

// Fetched only while the Issues tab is showing, so a user who never opens it
// never spends the request. Every caller has to say whether it's showing —
// a default would let one careless observer turn the saving off for all of them.
export function repoIssuesQueryOptions(
  slug: string | undefined,
  showing: boolean,
) {
  return {
    queryKey: ["repoIssues", slug],
    queryFn: () => window.api.listRepoIssues(slug ?? ""),
    enabled: Boolean(slug) && showing,
  } as const;
}

// GitHub's own open totals for every registered repo, in one request. These are
// truer than the loaded lists, which are capped — so the tab badges and the
// sidebar's repo rows both read this.
export function repoCountsQueryOptions() {
  return {
    queryKey: ["repoCounts"],
    queryFn: () => window.api.getRepoCounts(),
  } as const;
}

// A repo's checkouts: the main worktree plus any linked ones. Worktrees come and
// go while the app runs, so never trust a cached list.
export function worktreesQueryOptions(repoPath: string | undefined) {
  return {
    queryKey: ["worktrees", repoPath],
    queryFn: () => window.api.listWorktrees(repoPath ?? ""),
    enabled: Boolean(repoPath),
    staleTime: 0,
    refetchOnWindowFocus: true,
  } as const;
}
