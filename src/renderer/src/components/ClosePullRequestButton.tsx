import { Button, HStack } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LuGitPullRequestClosed, LuRotateCcw } from "react-icons/lu";
import type { PullRequestDetail } from "../../../shared/types";
import { toaster } from "./ui/toaster";

interface Props {
  detail: PullRequestDetail;
}

// Close (with an inline confirm step) or reopen the PR. Hidden for merged
// PRs — their state can't change.
export default function ClosePullRequestButton({ detail }: Props) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const closed = detail.state === "closed";

  const mutation = useMutation({
    mutationFn: () =>
      window.api.setPullRequestState(
        detail.repo,
        detail.number,
        closed ? "open" : "closed",
      ),
    onSuccess: () => {
      toaster.create({
        type: "success",
        title: closed ? "Pull request reopened" : "Pull request closed",
        description: `${detail.repo}#${detail.number} was ${closed ? "reopened" : "closed"}.`,
      });
      setConfirming(false);
      // State changes ripple everywhere open PRs show: the detail, the PR
      // lists, both sidebar sections, and the repo rows' open counts.
      void queryClient.invalidateQueries({
        queryKey: ["pullRequest", detail.repo, detail.number],
      });
      void queryClient.invalidateQueries({ queryKey: ["pullRequests"] });
      void queryClient.invalidateQueries({ queryKey: ["myPullRequests"] });
      void queryClient.invalidateQueries({ queryKey: ["reviewRequests"] });
      void queryClient.invalidateQueries({ queryKey: ["openPrCounts"] });
    },
    onError: (cause) => {
      setConfirming(false);
      toaster.create({
        type: "error",
        title: closed ? "Couldn’t reopen" : "Couldn’t close",
        description:
          cause instanceof Error
            ? cause.message.replace(/^.*Error: /, "")
            : String(cause),
        closable: true,
      });
    },
  });

  if (detail.merged) return null;

  if (closed) {
    return (
      <Button
        size="xs"
        variant="outline"
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        <LuRotateCcw /> Reopen pull request
      </Button>
    );
  }

  if (confirming) {
    return (
      <HStack gap="1">
        <Button
          size="xs"
          colorPalette="red"
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Confirm close
        </Button>
        <Button
          size="xs"
          variant="ghost"
          disabled={mutation.isPending}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </HStack>
    );
  }

  return (
    <Button
      size="xs"
      variant="outline"
      colorPalette="red"
      onClick={() => setConfirming(true)}
    >
      <LuGitPullRequestClosed /> Close pull request
    </Button>
  );
}
