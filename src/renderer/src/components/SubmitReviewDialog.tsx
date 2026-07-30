import {
  Box,
  Button,
  CloseButton,
  Dialog,
  HStack,
  Portal,
  RadioGroup,
  Stack,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { PullRequest, ReviewVerdict } from "../../../shared/types";
import { toaster } from "./ui/toaster";

const verdictOptions: Array<{
  value: ReviewVerdict;
  label: string;
  description: string;
  palette: string;
}> = [
  {
    value: "comment",
    label: "Comment",
    description: "Submit general feedback without explicit approval.",
    palette: "gray",
  },
  {
    value: "approve",
    label: "Approve",
    description: "Submit feedback and approve merging these changes.",
    palette: "green",
  },
  {
    value: "request_changes",
    label: "Request changes",
    description: "Submit feedback suggesting changes.",
    palette: "red",
  },
];

interface Props {
  pr: PullRequest;
  // Opened from the review header's actions menu, which owns the state.
  open: boolean;
  onOpenChange(open: boolean): void;
}

export default function SubmitReviewDialog({ pr, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [verdict, setVerdict] = useState<ReviewVerdict>("comment");

  // Locally drafted inline comments — submitted (and cleared) with the
  // review, so both the trigger and the dialog surface them.
  const draftsQuery = useQuery({
    queryKey: ["draftComments", pr.repo, pr.number],
    queryFn: () => window.api.listDraftComments(pr.repo, pr.number),
  });
  const drafts = draftsQuery.data ?? [];

  const submit = useMutation({
    mutationFn: () =>
      window.api.submitReview(pr.repo, pr.number, verdict, body.trim()),
    onSuccess: () => {
      toaster.create({
        type: "success",
        title: "Review submitted",
        description: `${pr.repo}#${pr.number} — ${labelFor(verdict)}.`,
      });
      onOpenChange(false);
      setBody("");
      setVerdict("comment");
      // The review changes the PR's review status; refetch what shows it —
      // the detail, the Overview's review timeline, the PR lists, and the
      // sidebar's review-requested section (approving clears the request).
      void queryClient.invalidateQueries({
        queryKey: ["pullRequest", pr.repo, pr.number],
      });
      void queryClient.invalidateQueries({
        queryKey: ["pullRequestReviews", pr.repo, pr.number],
      });
      // An approval can clear REVIEW_REQUIRED, which reveals the merge button.
      void queryClient.invalidateQueries({
        queryKey: ["reviewDecision", pr.repo, pr.number],
      });
      // Drafts became real inline comments and were cleared server-side.
      void queryClient.invalidateQueries({
        queryKey: ["draftComments", pr.repo, pr.number],
      });
      void queryClient.invalidateQueries({
        queryKey: ["reviewComments", pr.repo, pr.number],
      });
      void queryClient.invalidateQueries({ queryKey: ["pullRequests"] });
      void queryClient.invalidateQueries({ queryKey: ["reviewRequests"] });
    },
    onError: (cause) => {
      toaster.create({
        type: "error",
        title: "Couldn’t submit review",
        description:
          cause instanceof Error
            ? cause.message.replace(/^.*Error: /, "")
            : String(cause),
        closable: true,
      });
    },
  });

  // GitHub rejects a plain comment review with no text — unless drafted
  // comments are going with it; approvals don't need one either way.
  const needsBody =
    verdict === "comment" && body.trim().length === 0 && drafts.length === 0;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(event) => onOpenChange(event.open)}
      size="md"
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Finish your review</Dialog.Title>
            </Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
            <Dialog.Body>
              <VStack alignItems="stretch" gap="4">
                {drafts.length > 0 && (
                  <Box borderWidth="1px" rounded="md" px="3" py="2.5">
                    <Text fontSize="xs" fontWeight="medium" mb="1.5">
                      {drafts.length} pending comment
                      {drafts.length === 1 ? "" : "s"} will be submitted with
                      this review
                    </Text>
                    <Stack gap="1">
                      {drafts.map((draft) => (
                        <HStack key={draft.id} gap="2" minW="0">
                          <Text
                            fontSize="xs"
                            fontFamily="mono"
                            color="fg.muted"
                            truncate
                          >
                            {draft.path}:{draft.line}
                          </Text>
                          <Text fontSize="xs" truncate flex="1">
                            {draft.body}
                          </Text>
                        </HStack>
                      ))}
                    </Stack>
                  </Box>
                )}
                <Textarea
                  placeholder="Leave a comment"
                  rows={6}
                  resize="vertical"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
                <RadioGroup.Root
                  value={verdict}
                  onValueChange={(event) =>
                    setVerdict((event.value ?? "comment") as ReviewVerdict)
                  }
                >
                  <VStack alignItems="stretch" gap="3">
                    {verdictOptions.map((option) => (
                      <RadioGroup.Item
                        key={option.value}
                        value={option.value}
                        colorPalette={option.palette}
                        alignItems="flex-start"
                        cursor="pointer"
                      >
                        <RadioGroup.ItemHiddenInput />
                        <RadioGroup.ItemIndicator mt="0.5" />
                        <VStack alignItems="flex-start" gap="0">
                          <RadioGroup.ItemText fontWeight="medium">
                            {option.label}
                          </RadioGroup.ItemText>
                          <Text fontSize="xs" color="fg.muted">
                            {option.description}
                          </Text>
                        </VStack>
                      </RadioGroup.Item>
                    ))}
                  </VStack>
                </RadioGroup.Root>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer gap="2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                colorPalette="green"
                disabled={needsBody}
                loading={submit.isPending}
                onClick={() => submit.mutate()}
              >
                Submit review
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

function labelFor(verdict: ReviewVerdict): string {
  return (
    verdictOptions.find((option) => option.value === verdict)?.label ?? verdict
  );
}
