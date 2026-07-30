import {
  Button,
  CloseButton,
  Dialog,
  IconButton,
  Portal,
  Text,
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LuEraser } from "react-icons/lu";
import { toaster } from "./ui/toaster";

interface Props {
  repo: string;
  prNumber: number;
}

// Takes a PR out of the sidebar's Analysed section. That list is the analysis
// cache, so this really deletes the saved analyses — hence the confirmation:
// analysing again is another paid model call.
export default function ClearAnalysisButton({ repo, prNumber }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const clear = useMutation({
    mutationFn: () => window.api.deleteAnalyses(repo, prNumber),
    onSuccess: () => {
      setOpen(false);
      queryClient.setQueryData(["analysis", repo, prNumber], null);
      void queryClient.invalidateQueries({
        queryKey: ["analyzedPullRequests"],
      });
    },
    onError: (cause) => {
      toaster.create({
        type: "error",
        title: "Couldn’t clear the analysis",
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
    },
  });

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
        <IconButton
          aria-label="Clear this analysis"
          title="Clear this analysis"
          size="2xs"
          variant="ghost"
          color="fg.muted"
        >
          <LuEraser />
        </IconButton>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Clear this analysis?</Dialog.Title>
            </Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
            <Dialog.Body>
              <Text fontSize="sm" color="fg.muted">
                {repo}#{prNumber} leaves the Analysed list and its saved review
                is deleted. The pull request itself isn’t touched, and you can
                analyse it again — which costs another API call.
              </Text>
            </Dialog.Body>
            <Dialog.Footer gap="2">
              <Button
                size="sm"
                variant="outline"
                disabled={clear.isPending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                colorPalette="red"
                loading={clear.isPending}
                onClick={() => clear.mutate()}
              >
                Clear analysis
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
