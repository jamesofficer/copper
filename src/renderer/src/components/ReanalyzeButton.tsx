import {
  Button,
  CloseButton,
  createListCollection,
  Dialog,
  Field,
  Portal,
  Select,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LuBot } from "react-icons/lu";
import type { PullRequest, ReviewPersonality } from "../../../shared/types";
import { startAnalysis, useAnalysisJob } from "../lib/analysisJobs";
import {
  getReviewPersonality,
  personalityOptions,
} from "../lib/reviewPersonality";

const personalityCollection = createListCollection({
  items: personalityOptions.map((option) => ({
    label: option.label,
    value: option.value,
    description: option.description,
  })),
});

interface Props {
  pr: PullRequest;
  size?: "xs" | "2xs";
}

// Runs a fresh analysis after a confirmation, wiping the current review and
// chat instead of leaving them on screen. Hidden until the PR has an analysis.
export default function ReanalyzeButton({ pr, size = "xs" }: Props) {
  const [open, setOpen] = useState(false);
  const [personality, setPersonality] =
    useState<ReviewPersonality>(getReviewPersonality);

  const { data: analysis } = useQuery({
    queryKey: ["analysis", pr.repo, pr.number],
    queryFn: () => window.api.getAnalysis(pr.repo, pr.number),
  });

  // Shared with the Analyse button and the sidebar: the run outlives this
  // screen, and reports itself with a toast.
  const job = useAnalysisJob(pr.repo, pr.number);

  if (!analysis && !job) return null;

  return (
    <Dialog.Root
      role="alertdialog"
      open={open}
      onOpenChange={(event) => {
        setOpen(event.open);
        // Start each confirmation from the global setting, not a leftover
        // override from a previous run.
        if (event.open) setPersonality(getReviewPersonality());
      }}
      size="sm"
      lazyMount
      unmountOnExit
    >
      <Dialog.Trigger asChild>
        <Button
          size={size}
          variant="outline"
          loading={Boolean(job)}
          loadingText="Re-analysing…"
        >
          <LuBot /> Re-analyse
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
              <VStack alignItems="stretch" gap="4">
                <Text fontSize="sm" color="fg.muted">
                  This runs a fresh analysis of the current commit and clears
                  the review chat. The existing summary, issues, and
                  conversation will be replaced.
                </Text>
                <Field.Root>
                  <Field.Label>Personality</Field.Label>
                  <Select.Root
                    collection={personalityCollection}
                    value={[personality]}
                    onValueChange={(details) => {
                      const value = details.value[0];
                      if (value) setPersonality(value as ReviewPersonality);
                    }}
                    size="sm"
                  >
                    <Select.HiddenSelect />
                    <Select.Control>
                      <Select.Trigger cursor="pointer">
                        <Select.ValueText />
                      </Select.Trigger>
                      <Select.IndicatorGroup>
                        <Select.Indicator />
                      </Select.IndicatorGroup>
                    </Select.Control>
                    <Select.Positioner>
                      <Select.Content>
                        {personalityCollection.items.map((item) => (
                          <Select.Item item={item} key={item.value}>
                            <VStack gap="0" alignItems="flex-start">
                              <Text>{item.label}</Text>
                              <Text fontSize="xs" color="fg.muted">
                                {item.description}
                              </Text>
                            </VStack>
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Select.Root>
                  <Field.HelperText>
                    Just for this analysis — your default in Settings → Review
                    stays as it is.
                  </Field.HelperText>
                </Field.Root>
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
                size="sm"
                onClick={() => {
                  setOpen(false);
                  void startAnalysis(pr, {
                    force: true,
                    personality,
                    clearChat: true,
                  });
                }}
              >
                <LuBot /> Re-analyse
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
