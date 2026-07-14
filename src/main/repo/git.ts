// TODO: git plumbing via simple-git — fetch PR head refs, diff, log, blame
export async function fetchPullRequestRef(repoPath: string, prNumber: number): Promise<void> {
  throw new Error(`Git operations not implemented yet (${repoPath}#${prNumber})`)
}
