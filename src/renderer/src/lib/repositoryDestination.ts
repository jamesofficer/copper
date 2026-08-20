// The repository destination that the sidebar marks as active. A pull request
// tab marks only its repository because it is not one of these destinations.
export type RepositoryDestination =
  | { kind: "pullRequests"; repoPath: string }
  | { kind: "repoIssues"; repoPath: string }
  | { kind: "localChanges"; repoPath: string; worktreePath: string }
  | null;
