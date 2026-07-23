import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";

const DAY = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Keep cached data around long enough to be worth persisting.
      gcTime: DAY,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Query keys that never get written to localStorage: file patches are too
// large for its ~5MB quota and are cheap to refetch.
const doNotPersist = ["pullRequestFiles", "commitFiles", "fileAtCommit"];

export const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister: createSyncStoragePersister({
    storage: window.localStorage,
    key: "pr-reviewer-query-cache",
  }),
  maxAge: DAY,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) &&
      !doNotPersist.includes(String(query.queryKey[0])),
  },
};
