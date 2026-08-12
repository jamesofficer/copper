import { Box, Button, Stack, Textarea } from "@chakra-ui/react";
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { LuGitCommitHorizontal } from "react-icons/lu";
import {
  invalidateLocalChangeQueries,
  localChangesWriteMutationKey,
} from "../lib/localChangesMutations";
import { toaster } from "./ui/toaster";

interface Props {
  // The checkout to commit in — the registered repo path, or a worktree.
  path: string;
  stagedCount: number;
  // Set while a past commit is being read: the box stays in place, greyed out,
  // rather than unmounting and shifting the panels above it.
  disabled?: boolean;
}

// Commits the index of one checkout. Staging is the only way changes reach a
// commit here — there is no "commit all", deliberately: the file list above
// is the record of what is about to be committed.
export default function CommitComposer({ path, stagedCount, disabled }: Props) {
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();
  const writeMutationKey = localChangesWriteMutationKey(path);
  const writesPending = useIsMutating({ mutationKey: writeMutationKey }) > 0;

  const commit = useMutation({
    mutationKey: writeMutationKey,
    mutationFn: () => window.api.commitChanges(path, message),
    onSuccess: (result) => {
      setMessage("");
      toaster.create({
        type: "success",
        title: `Committed ${result.sha}`,
        description: result.subject,
      });
      void invalidateLocalChangeQueries(queryClient, path);
    },
    onError: (error) => {
      // git's stderr — a failed pre-commit hook or an unset user.email says
      // here what went wrong.
      toaster.create({
        type: "error",
        title: "Couldn't commit",
        description: error instanceof Error ? error.message : String(error),
      });
      void invalidateLocalChangeQueries(queryClient, path);
    },
  });

  const ready =
    !disabled && stagedCount > 0 && message.trim() !== "" && !writesPending;

  return (
    <Stack gap="2" px="3" py="3" borderTopWidth="1px" flexShrink="0">
      <Textarea
        size="xs"
        rows={3}
        resize="none"
        disabled={disabled}
        placeholder={
          disabled
            ? "Reading a past commit"
            : stagedCount > 0
              ? "Commit message"
              : "Stage a file to commit"
        }
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            if (ready && !commit.isPending) commit.mutate();
          }
        }}
      />
      <Button
        size="xs"
        disabled={!ready}
        loading={commit.isPending}
        onClick={() => commit.mutate()}
      >
        <Box asChild>
          <LuGitCommitHorizontal />
        </Box>
        {!disabled && stagedCount > 0
          ? `Commit ${stagedCount} file${stagedCount === 1 ? "" : "s"}`
          : "Commit"}
      </Button>
    </Stack>
  );
}
