import {
  Alert,
  Button,
  CloseButton,
  Dialog,
  Portal,
  RadioGroup,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LuGitMerge } from "react-icons/lu";
import type { MergeMethod, PullRequestDetail } from "../../../shared/types";
import { toaster } from "./ui/toaster";

const methodOptions: Array<{
  value: MergeMethod;
  label: string;
  description: string;
}> = [
  {
    value: "merge",
    label: "Create a merge commit",
    description: "All commits from this branch are added to the base branch.",
  },
  {
    value: "squash",
    label: "Squash and merge",
    description: "The commits are combined into one commit on the base branch.",
  },
  {
    value: "rebase",
    label: "Rebase and merge",
    description: "The commits are replayed onto the base branch individually.",
  },
];

interface Props {
  detail: PullRequestDetail;
}

// GitHub reports "dirty" when the branch has conflicts that block a merge.
function hasConflicts(detail: PullRequestDetail): boolean {
  return detail.mergeable === false || detail.mergeableState === "dirty";
}

export default function MergeDialog({ detail }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<MergeMethod>("merge");

  const merge = useMutation({
    mutationFn: () =>
      window.api.mergePullRequest(detail.repo, detail.number, method),
    onSuccess: () => {
      toaster.create({
        type: "success",
        title: "Pull request merged",
        description: `${detail.repo}#${detail.number} was merged.`,
      });
      setOpen(false);
      void queryClient.invalidateQueries({
        queryKey: ["pullRequest", detail.repo, detail.number],
      });
      void queryClient.invalidateQueries({ queryKey: ["pullRequests"] });
    },
    onError: (cause) => {
      toaster.create({
        type: "error",
        title: "Couldn’t merge",
        description:
          cause instanceof Error
            ? cause.message.replace(/^.*Error: /, "")
            : String(cause),
        closable: true,
      });
    },
  });

  const conflicts = hasConflicts(detail);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(event) => setOpen(event.open)}
      size="md"
      lazyMount
      unmountOnExit
    >
      <Dialog.Trigger asChild>
        <Button size="xs" colorPalette="green">
          <LuGitMerge /> Merge pull request
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Merge pull request</Dialog.Title>
            </Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
            <Dialog.Body>
              <VStack alignItems="stretch" gap="4">
                <Text fontSize="sm" color="fg.muted">
                  Merge{" "}
                  <Text as="span" fontFamily="mono">
                    {detail.headRef}
                  </Text>{" "}
                  into{" "}
                  <Text as="span" fontFamily="mono">
                    {detail.baseRef}
                  </Text>
                  .
                </Text>

                {conflicts && (
                  <Alert.Root status="warning" size="sm">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>
                        This branch has conflicts that must be resolved before
                        it can be merged.
                      </Alert.Description>
                    </Alert.Content>
                  </Alert.Root>
                )}

                <RadioGroup.Root
                  value={method}
                  onValueChange={(event) =>
                    setMethod((event.value ?? "merge") as MergeMethod)
                  }
                >
                  <VStack alignItems="stretch" gap="3">
                    {methodOptions.map((option) => (
                      <RadioGroup.Item
                        key={option.value}
                        value={option.value}
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
                disabled={conflicts}
                loading={merge.isPending}
                onClick={() => merge.mutate()}
              >
                Confirm merge
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
