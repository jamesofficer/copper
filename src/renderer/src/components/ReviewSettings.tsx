import {
  Box,
  createListCollection,
  Select,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import type { ReviewPersonality } from "../../../shared/types";
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

  function selectPersonality(value: ReviewPersonality) {
    setReviewPersonality(value);
    setPersonality(value);
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
    </Stack>
  );
}
