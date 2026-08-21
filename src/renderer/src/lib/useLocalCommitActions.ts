import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toaster } from "../components/ui/toaster";
import {
  invalidateLocalChangeQueries,
  invalidateLocalCommitQueries,
  localChangesWriteMutationKey,
} from "./localChangesMutations";

interface Args {
  path: string;
  message: string;
  onCommitted(): void;
}

interface LocalCommitActions {
  writesPending: boolean;
  commitPending: boolean;
  pushPending: boolean;
  commit(): void;
  push(): void;
}

// This hook coordinates branch writes and their query updates. The component
// only decides when its controls are ready.
export function useLocalCommitActions({
  path,
  message,
  onCommitted,
}: Args): LocalCommitActions {
  const queryClient = useQueryClient();
  const writeMutationKey = localChangesWriteMutationKey(path);
  const writesPending = useIsMutating({ mutationKey: writeMutationKey }) > 0;

  function refresh(): void {
    void Promise.all([
      invalidateLocalChangeQueries(queryClient, path),
      invalidateLocalCommitQueries(queryClient, path),
    ]);
  }

  const commit = useMutation({
    mutationKey: writeMutationKey,
    mutationFn: () => window.api.commitChanges(path, message),
    onSuccess: (result) => {
      onCommitted();
      toaster.create({
        type: "success",
        title: `Committed ${result.sha}`,
        description: result.subject,
      });
      refresh();
    },
    onError: (error) => {
      toaster.create({
        type: "error",
        title: "Couldn't commit",
        description: error instanceof Error ? error.message : String(error),
      });
      void invalidateLocalChangeQueries(queryClient, path);
    },
  });

  const push = useMutation({
    mutationKey: writeMutationKey,
    mutationFn: () => window.api.pushLocalBranch(path),
    onSuccess: (result) => {
      toaster.create({
        type: "success",
        title: `Pushed ${result.branch}`,
        description: `Updated ${result.target}`,
      });
    },
    onError: (error) => {
      toaster.create({
        type: "error",
        title: "Couldn't push",
        description: error instanceof Error ? error.message : String(error),
      });
    },
    onSettled: refresh,
  });

  return {
    writesPending,
    commitPending: commit.isPending,
    pushPending: push.isPending,
    commit: commit.mutate,
    push: push.mutate,
  };
}
