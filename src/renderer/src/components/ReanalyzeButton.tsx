import { Button, CloseButton, Dialog, Portal, Text } from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LuRefreshCw } from "react-icons/lu";
import type { PullRequest } from "../../../shared/types";
import { getReviewPersonality } from "../lib/reviewPersonality";
import { toaster } from "./ui/toaster";

interface Props {
  pr: PullRequest;
  size?: "xs" | "2xs";
}

// Runs a fresh analysis after a confirmation, wiping the current review and
// chat instead of leaving them on screen. Hidden until the PR has an analysis.
export default function ReanalyzeButton({ pr, size = "xs" }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: analysis } = useQuery({
    queryKey: ["analysis", pr.repo, pr.number],
    queryFn: () => window.api.getAnalysis(pr.repo, pr.number),
  });

  const reanalyze = useMutation({
    mutationKey: ["analyzePr", pr.repo, pr.number],
    mutationFn: async () => {
      await window.api.clearChat(pr.repo, pr.number);
      return window.api.analyzePullRequest(
        pr.repo,
        pr.number,
        getReviewPersonality(),
        true,
      );
    },
    onMutate: () => {
      // Wipe the old review from screen — the Review tab drops back to its
      // analysing state instead of showing stale content.
      queryClient.setQueryData(["analysis", pr.repo, pr.number], null);
      queryClient.setQueryData(["chatHistory", pr.repo, pr.number], []);
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["analysis", pr.repo, pr.number], result);
      void queryClient.invalidateQueries({
        queryKey: ["analyzedPullRequests"],
      });
    },
    onError: (cause) => {
      toaster.create({
        type: "error",
        title: "Re-analysis failed",
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
      // Bring the previous analysis back rather than leaving a blank tab.
      void queryClient.invalidateQueries({
        queryKey: ["analysis", pr.repo, pr.number],
      });
    },
  });

  if (!analysis && !reanalyze.isPending) return null;

  return (
    <Dialog.Root
      role="alertdialog"
      open={open}
      onOpenChange={(event) => setOpen(event.open)}
      size="sm"
      lazyMount
      unmountOnExit
    >
      <Dialog.Trigger asChild>
        <Button
          size={size}
          variant="outline"
          loading={reanalyze.isPending}
          loadingText="Re-analysing…"
        >
          <LuRefreshCw /> Re-analyse
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Re-analyse this pull request?</Dialog.Title>
            </Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
            <Dialog.Body>
              <Text fontSize="sm" color="fg.muted">
                This runs a fresh analysis of the current commit and clears the
                review chat. The existing summary and conversation will be
                replaced.
              </Text>
            </Dialog.Body>
            <Dialog.Footer gap="2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setOpen(false);
                  reanalyze.mutate();
                }}
              >
                <LuRefreshCw /> Re-analyse
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
