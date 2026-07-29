import { Button, HStack } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LuGitPullRequestArrow } from "react-icons/lu";
import type { PullRequestDetail } from "../../../shared/types";
import { toaster } from "./ui/toaster";

interface Props {
  detail: PullRequestDetail;
}

// Take a draft PR out of draft ("Ready for review"), with an inline confirm
// step. Only shown for open draft PRs.
export default function MarkReadyButton({ detail }: Props) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      window.api.setPullRequestReady(detail.repo, detail.number),
    onSuccess: () => {
      toaster.create({
        type: "success",
        title: "Marked ready for review",
        description: `${detail.repo}#${detail.number} is no longer a draft.`,
      });
      setConfirming(false);
      // The draft flag shows across the PR lists and sidebar sections too.
      void queryClient.invalidateQueries({
        queryKey: ["pullRequest", detail.repo, detail.number],
      });
      void queryClient.invalidateQueries({ queryKey: ["pullRequests"] });
      void queryClient.invalidateQueries({ queryKey: ["myPullRequests"] });
      void queryClient.invalidateQueries({ queryKey: ["reviewRequests"] });
    },
    onError: (cause) => {
      setConfirming(false);
      toaster.create({
        type: "error",
        title: "Couldn’t mark ready",
        description:
          cause instanceof Error
            ? cause.message.replace(/^.*Error: /, "")
            : String(cause),
        closable: true,
      });
    },
  });

  if (detail.merged || detail.state !== "open" || !detail.draft) return null;

  if (confirming) {
    return (
      <HStack gap="1">
        <Button
          size="2xs"
          colorPalette="green"
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Confirm ready
        </Button>
        <Button
          size="2xs"
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
      size="2xs"
      variant="outline"
      colorPalette="green"
      onClick={() => setConfirming(true)}
    >
      <LuGitPullRequestArrow /> Ready for review
    </Button>
  );
}
