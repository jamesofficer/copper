import { createListCollection, Select, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { ReviewPersonality } from "../../../shared/types";
import {
  getReviewPersonality,
  personalityOptions,
  setReviewPersonality,
} from "../lib/reviewPersonality";
import { SettingRow, SettingsGroup, SettingsPanel } from "./SettingsLayout";

const personalityCollection = createListCollection({
  items: personalityOptions.map((option) => ({
    label: option.label,
    value: option.value,
    description: option.description,
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
    <SettingsPanel
      title="Review"
      description="How the agent reads a pull request. How deep each review goes is picked per run, on the Review tab."
    >
      <SettingsGroup>
        <SettingRow
          title="Review personality"
          description="The voice the analysis is written in. Changes the wording only, never what gets reported. Applies to new analyses only; already-analysed PRs keep their previously generated text."
        >
          <Stack gap="1.5" alignItems="flex-end">
            <Select.Root
              collection={personalityCollection}
              value={[personality]}
              onValueChange={(event) =>
                selectPersonality(event.value[0] as ReviewPersonality)
              }
              size="sm"
              w="52"
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
                      <Stack gap="0" alignItems="flex-start">
                        <Text>{item.label}</Text>
                        <Text fontSize="xs" color="fg.muted">
                          {item.description}
                        </Text>
                      </Stack>
                      <Select.ItemIndicator />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Positioner>
            </Select.Root>
            <Text
              fontSize="xs"
              color="fg.subtle"
              w="52"
              textAlign="right"
              lineHeight="1.4"
            >
              {descriptionFor(personality)}
            </Text>
          </Stack>
        </SettingRow>
      </SettingsGroup>
    </SettingsPanel>
  );
}
