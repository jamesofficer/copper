import {
  Box,
  createListCollection,
  Select,
  Stack,
  Switch,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import type { ReviewPersonality } from "../../../shared/types";
import {
  getFindIssuesOnAnalyse,
  setFindIssuesOnAnalyse,
} from "../lib/findIssuesOnAnalyse";
import {
  getReviewPersonality,
  personalityOptions,
  setReviewPersonality,
} from "../lib/reviewPersonality";

const personalityCollection = createListCollection({
  items: personalityOptions.map((option) => ({
    label: option.label,
    value: option.value,
  })),
});

function descriptionFor(personality: ReviewPersonality): string {
  return (
    personalityOptions.find((option) => option.value === personality)
      ?.description ?? ""
  );
}

export default function ReviewSettings() {
  const [personality, setPersonality] =
    useState<ReviewPersonality>(getReviewPersonality);
  const [findIssues, setFindIssues] = useState<boolean>(getFindIssuesOnAnalyse);

  function selectPersonality(value: ReviewPersonality) {
    setReviewPersonality(value);
    setPersonality(value);
  }

  function toggleFindIssues(enabled: boolean) {
    setFindIssuesOnAnalyse(enabled);
    setFindIssues(enabled);
  }

  return (
    <Stack gap="6">
      <Stack gap="3">
        <Box>
          <Text fontWeight="medium">Review personality</Text>
          <Text fontSize="sm" color="fg.muted">
            The voice the analysis is written in. Changes the wording only —
            never what gets reported.
          </Text>
        </Box>
        <Select.Root
          collection={personalityCollection}
          value={[personality]}
          onValueChange={(event) =>
            selectPersonality(event.value[0] as ReviewPersonality)
          }
          size="sm"
          maxW="56"
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
                  <Text>{item.label}</Text>
                  <Select.ItemIndicator />
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Positioner>
        </Select.Root>
        <Text fontSize="sm" color="fg.muted" fontStyle="italic">
          {descriptionFor(personality)}
        </Text>
        <Text fontSize="xs" color="fg.subtle">
          Applies to new analyses. Already-analysed PRs keep their existing
          text.
        </Text>
      </Stack>

      <Stack gap="3">
        <Box>
          <Text fontWeight="medium">Find issues when analysing</Text>
          <Text fontSize="sm" color="fg.muted">
            After each analysis, automatically run the deeper agent pass that
            checks the repo beyond the diff and verifies the flagged risks.
            Roughly doubles the cost of a scan.
          </Text>
        </Box>
        <Switch.Root
          checked={findIssues}
          onCheckedChange={(event) => toggleFindIssues(event.checked)}
          size="sm"
        >
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label>
            {findIssues
              ? "On — runs with every analysis"
              : "Off — run it manually from the Issues section"}
          </Switch.Label>
        </Switch.Root>
      </Stack>
    </Stack>
  );
}
