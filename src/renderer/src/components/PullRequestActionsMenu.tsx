import {
  Badge,
  Button,
  CloseButton,
  Dialog,
  Menu,
  Portal,
  Text,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LuChevronDown,
  LuGitMerge,
  LuGitPullRequestArrow,
  LuGitPullRequestClosed,
  LuPenLine,
  LuRotateCcw,
  LuUserMinus,
} from "react-icons/lu";
import type { PullRequest, PullRequestDetail } from "../../../shared/types";
import MergeDialog, { useMergeAvailability } from "./MergeDialog";
import SubmitReviewDialog from "./SubmitReviewDialog";
import { toaster } from "./ui/toaster";

interface Props {
  pr: PullRequest;
  detail: PullRequestDetail;
}

// The PR's state-changing actions, gathered behind one "more" button in the
// review header. Everything here is outward-facing, so each action confirms
// first — except reopening, which undoes rather than destroys.
type ActionKey = "ready" | "removeReviewer" | "close";

const confirmations: Record<
  ActionKey,
  { title: string; description: string; confirmLabel: string; danger: boolean }
> = {
  ready: {
    title: "Mark as ready for review?",
    description:
      "This takes the pull request out of draft and notifies its reviewers.",
    confirmLabel: "Mark ready",
    danger: false,
  },
  removeReviewer: {
    title: "Remove your review request?",
    description:
      "This takes you off the pull request's reviewers on GitHub. The author sees it in the timeline, and a request from a team or CODEOWNERS can come back on the next push.",
    confirmLabel: "Remove me",
    danger: true,
  },
  close: {
    title: "Close this pull request?",
    description:
      "The branch and its commits stay put, and the pull request can be reopened later.",
    confirmLabel: "Close pull request",
    danger: true,
  },
};

export default function PullRequestActionsMenu({ pr, detail }: Props) {
  const queryClient = useQueryClient();
  // The dialog's open flag is separate from the action it's confirming, so the
  // text doesn't blank out while the dialog animates closed.
  const [pending, setPending] = useState<ActionKey | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Submitting a review and merging are whole dialogs of their own, opened
  // from here rather than from their own header buttons.
  const [reviewOpen, setReviewOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  function ask(action: ActionKey) {
    setPending(action);
    setConfirmOpen(true);
  }

  // Pending inline comments go out with the review, so their count is worth
  // surfacing on the trigger — the old Submit review button showed it.
  const draftsQuery = useQuery({
    queryKey: ["draftComments", detail.repo, detail.number],
    queryFn: () => window.api.listDraftComments(detail.repo, detail.number),
  });
  const draftCount = draftsQuery.data?.length ?? 0;

  const viewerQuery = useQuery({
    queryKey: ["viewer"],
    queryFn: () => window.api.getViewer(),
    staleTime: Number.POSITIVE_INFINITY,
  });

  // A PR's state and draft flag show up in every list, both sidebar sections
  // and the repo rows' open counts.
  function invalidateEverywhere() {
    void queryClient.invalidateQueries({
      queryKey: ["pullRequest", detail.repo, detail.number],
    });
    void queryClient.invalidateQueries({ queryKey: ["pullRequests"] });
    void queryClient.invalidateQueries({ queryKey: ["myPullRequests"] });
    void queryClient.invalidateQueries({ queryKey: ["reviewRequests"] });
    void queryClient.invalidateQueries({ queryKey: ["openPrCounts"] });
  }

  function reportFailure(cause: unknown) {
    toaster.create({
      type: "error",
      title: "GitHub rejected that",
      description:
        cause instanceof Error
          ? cause.message.replace(/^.*Error: /, "")
          : String(cause),
      closable: true,
    });
  }

  const run = useMutation({
    mutationFn: (action: ActionKey) => {
      switch (action) {
        case "ready":
          return window.api.setPullRequestReady(detail.repo, detail.number);
        case "removeReviewer":
          return window.api.removeReviewRequest(detail.repo, detail.number);
        case "close":
          return window.api.setPullRequestState(
            detail.repo,
            detail.number,
            "closed",
          );
      }
    },
    onSuccess: (_result, action) => {
      setConfirmOpen(false);
      const titles: Record<ActionKey, string> = {
        ready: "Marked ready for review",
        removeReviewer: "Review request removed",
        close: "Pull request closed",
      };
      toaster.create({
        type: "success",
        title: titles[action],
        description: `${detail.repo}#${detail.number}`,
      });
      invalidateEverywhere();
    },
    onError: (cause) => {
      setConfirmOpen(false);
      reportFailure(cause);
    },
  });

  const reopen = useMutation({
    mutationFn: () =>
      window.api.setPullRequestState(detail.repo, detail.number, "open"),
    onSuccess: () => {
      toaster.create({
        type: "success",
        title: "Pull request reopened",
        description: `${detail.repo}#${detail.number}`,
      });
      invalidateEverywhere();
    },
    onError: reportFailure,
  });

  const isOpen = detail.state === "open" && !detail.merged;
  const viewer = viewerQuery.data;
  const canMarkReady = isOpen && detail.draft;
  const canRemoveSelf =
    isOpen && Boolean(viewer && detail.reviewers.includes(viewer));
  const canReopen = detail.state === "closed" && !detail.merged;
  const canReview = !detail.merged;
  const { awaitingApproval, canMerge } = useMergeAvailability(detail);
  const showMerge = canMerge && !awaitingApproval;

  // A merged PR can't be reviewed, reopened or changed at all.
  if (!isOpen && !canReopen && !canReview) return null;

  const confirmation = pending ? confirmations[pending] : null;

  return (
    <>
      <Menu.Root positioning={{ placement: "bottom-end" }}>
        <Menu.Trigger asChild>
          <Button
            variant="outline"
            size="xs"
            loading={run.isPending || reopen.isPending}
          >
            Actions
            {draftCount > 0 && (
              <Badge size="xs" colorPalette="yellow" variant="solid">
                {draftCount}
              </Badge>
            )}
            <LuChevronDown />
          </Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="60">
              {canReview && (
                <Menu.Item value="review" onClick={() => setReviewOpen(true)}>
                  <LuPenLine /> Submit review
                  {draftCount > 0 ? ` (${draftCount})` : ""}
                </Menu.Item>
              )}
              {showMerge && (
                <Menu.Item value="merge" onClick={() => setMergeOpen(true)}>
                  <LuGitMerge /> Merge pull request
                </Menu.Item>
              )}
              {(canReview || showMerge) &&
                (canMarkReady || canRemoveSelf || isOpen || canReopen) && (
                  <Menu.Separator />
                )}
              {canMarkReady && (
                <Menu.Item value="ready" onClick={() => ask("ready")}>
                  <LuGitPullRequestArrow /> Ready for review…
                </Menu.Item>
              )}
              {canRemoveSelf && (
                <Menu.Item
                  value="removeReviewer"
                  onClick={() => ask("removeReviewer")}
                >
                  <LuUserMinus /> Remove me as reviewer…
                </Menu.Item>
              )}
              {isOpen && (
                <Menu.Item
                  value="close"
                  color="fg.error"
                  onClick={() => ask("close")}
                >
                  <LuGitPullRequestClosed /> Close pull request…
                </Menu.Item>
              )}
              {canReopen && (
                <Menu.Item value="reopen" onClick={() => reopen.mutate()}>
                  <LuRotateCcw /> Reopen pull request
                </Menu.Item>
              )}
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      <SubmitReviewDialog
        pr={pr}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
      />
      <MergeDialog
        detail={detail}
        open={mergeOpen}
        onOpenChange={setMergeOpen}
      />

      <Dialog.Root
        open={confirmOpen}
        onOpenChange={(event) => setConfirmOpen(event.open)}
        size="sm"
        lazyMount
        unmountOnExit
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{confirmation?.title}</Dialog.Title>
              </Dialog.Header>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
              <Dialog.Body>
                <Text fontSize="sm" color="fg.muted">
                  {confirmation?.description}
                </Text>
              </Dialog.Body>
              <Dialog.Footer gap="2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={run.isPending}
                  onClick={() => setConfirmOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  colorPalette={confirmation?.danger ? "red" : undefined}
                  loading={run.isPending}
                  onClick={() => pending && run.mutate(pending)}
                >
                  {confirmation?.confirmLabel}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}
