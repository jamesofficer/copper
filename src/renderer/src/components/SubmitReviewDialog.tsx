import {
  Button,
  CloseButton,
  Dialog,
  Portal,
  RadioGroup,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { LuPenLine } from "react-icons/lu";
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
}

export default function SubmitReviewDialog({ pr }: Props) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [verdict, setVerdict] = useState<ReviewVerdict>("comment");

  const submit = useMutation({
    mutationFn: () =>
      window.api.submitReview(pr.repo, pr.number, verdict, body.trim()),
    onSuccess: () => {
      toaster.create({
        type: "success",
        title: "Review submitted",
        description: `${pr.repo}#${pr.number} — ${labelFor(verdict)}.`,
      });
      setOpen(false);
      setBody("");
      setVerdict("comment");
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

  // GitHub rejects a plain comment review with no text; approvals don't need one.
  const needsBody = verdict === "comment" && body.trim().length === 0;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(event) => setOpen(event.open)}
      size="md"
      lazyMount
      unmountOnExit
    >
      <Dialog.Trigger asChild>
        <Button size="xs" variant="outline" colorPalette="green">
          <LuPenLine /> Submit review
        </Button>
      </Dialog.Trigger>
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
                onClick={() => setOpen(false)}
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
