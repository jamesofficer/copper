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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  // Opened from the review header's actions menu, which owns the state.
  open: boolean;
  onOpenChange(open: boolean): void;
}

// GitHub reports "dirty" when the branch has conflicts that block a merge.
function hasConflicts(detail: PullRequestDetail): boolean {
  return detail.mergeable === false || detail.mergeableState === "dirty";
}

// Whether merging is on the table at all. Repos can require review approval
// first; while GitHub says reviews are still needed, merging is hidden rather
// than offered and refused. A failed lookup returns null (fail open) — a wrong
// guess just errors on confirm. Shared with the actions menu, so the menu item
// and the dialog agree.
export function useMergeAvailability(detail: PullRequestDetail): {
  awaitingApproval: boolean;
  canMerge: boolean;
  approved: boolean;
} {
  const isOpen = detail.state === "open" && !detail.merged;
  const decisionQuery = useQuery({
    queryKey: ["reviewDecision", detail.repo, detail.number],
    queryFn: () => window.api.getReviewDecision(detail.repo, detail.number),
    enabled: isOpen,
  });
  const decision = decisionQuery.data;
  return {
    awaitingApproval:
      isOpen &&
      (decisionQuery.isPending ||
        decision === "REVIEW_REQUIRED" ||
        decision === "CHANGES_REQUESTED"),
    canMerge: isOpen && !detail.draft,
    approved: isOpen && decision === "APPROVED",
  };
}

export default function MergeDialog({ detail, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<MergeMethod>("merge");

  const { awaitingApproval } = useMergeAvailability(detail);

  // Repo settings can disable merge methods (e.g. squash-only repos); offer
  // only what GitHub would accept. Until they load (or if they fail), all
  // three show — a wrong pick just errors on confirm.
  const settingsQuery = useQuery({
    queryKey: ["repoMergeSettings", detail.repo],
    queryFn: () => window.api.getRepoMergeSettings(detail.repo),
    staleTime: 5 * 60 * 1000,
  });
  const allowed = settingsQuery.data?.allowedMethods;
  const options = allowed
    ? methodOptions.filter((option) => allowed.includes(option.value))
    : methodOptions;
  // Falls back to the repo's first allowed method when the picked one is off.
  const selectedMethod = options.some((option) => option.value === method)
    ? method
    : (options[0]?.value ?? "merge");

  const merge = useMutation({
    mutationFn: () =>
      window.api.mergePullRequest(detail.repo, detail.number, selectedMethod),
    onSuccess: () => {
      toaster.create({
        type: "success",
        title: "Pull request merged",
        description: `${detail.repo}#${detail.number} was merged.`,
      });
      onOpenChange(false);
      // Merging removes the PR from every open-PR view: the detail, the PR
      // lists, both sidebar sections, and the repo rows' open counts.
      void queryClient.invalidateQueries({
        queryKey: ["pullRequest", detail.repo, detail.number],
      });
      void queryClient.invalidateQueries({ queryKey: ["pullRequests"] });
      void queryClient.invalidateQueries({ queryKey: ["myPullRequests"] });
      void queryClient.invalidateQueries({ queryKey: ["reviewRequests"] });
      void queryClient.invalidateQueries({ queryKey: ["repoCounts"] });
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

  if (awaitingApproval) return null;

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
                  value={selectedMethod}
                  onValueChange={(event) =>
                    setMethod((event.value ?? "merge") as MergeMethod)
                  }
                >
                  <VStack alignItems="stretch" gap="3">
                    {options.map((option) => (
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
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                colorPalette="purple"
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
