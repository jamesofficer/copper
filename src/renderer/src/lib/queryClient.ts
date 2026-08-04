import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import { isRateLimitMessage } from "../../../shared/rateLimit";

const DAY = 24 * 60 * 60 * 1000;

// A retry of a PR-list query re-runs its whole fan-out (one request per PR), so
// retrying a rate-limit error doubles the burst that caused it. The main process
// already retries with backoff, so give up here instead. The error arrives as a
// plain string over IPC, so the matcher is shared rather than reimplemented.
function shouldRetry(failureCount: number, error: Error): boolean {
  if (isRateLimitMessage(error.message)) return false;
  return failureCount < 1;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Keep cached data around long enough to be worth persisting.
      gcTime: DAY,
      refetchOnWindowFocus: false,
      retry: shouldRetry,
    },
  },
});

// Query keys that never get written to localStorage: file patches are too
// large for its ~5MB quota and are cheap to refetch — and localChanges is
// stale the moment the working tree moves.
const doNotPersist = [
  "pullRequestFiles",
  "commitFiles",
  "fileAtCommit",
  "localChanges",
];

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
