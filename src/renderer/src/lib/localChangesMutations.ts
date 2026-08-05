import type { QueryClient } from "@tanstack/react-query";

export function localChangesWriteMutationKey(repoPath: string) {
  return ["localChangesWrite", repoPath] as const;
}

export async function invalidateLocalChangeQueries(
  queryClient: QueryClient,
  repoPath: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["localChanges", repoPath] }),
    queryClient.invalidateQueries({
      queryKey: ["localChangeCount", repoPath],
    }),
  ]);
}
