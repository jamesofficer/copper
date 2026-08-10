import {
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
  getHideTestFilesByDefault,
  setHideTestFilesByDefault,
} from "../lib/hideTestFiles";
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
  const [findIssues, setFindIssues] = useState<boolean>(getFindIssuesOnAnalyse);
  const [hideTestFiles, setHideTestFiles] = useState<boolean>(
    getHideTestFilesByDefault,
  );

  function selectPersonality(value: ReviewPersonality) {
    setReviewPersonality(value);
    setPersonality(value);
  }

  function toggleFindIssues(enabled: boolean) {
    setFindIssuesOnAnalyse(enabled);
    setFindIssues(enabled);
  }

  function toggleHideTestFiles(enabled: boolean) {
    setHideTestFilesByDefault(enabled);
    setHideTestFiles(enabled);
  }

  return (
    <SettingsPanel
      title="Review"
      description="How the agent reads a pull request, and how much of it runs on its own."
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

        <SettingRow
          title="Find issues when analysing"
          description="After each analysis, run the deeper agent pass that checks the repo beyond the diff and verifies the flagged risks. Roughly doubles the cost of a scan."
        >
          <Switch.Root
            checked={findIssues}
            onCheckedChange={(event) => toggleFindIssues(event.checked)}
            size="lg"
          >
            <Switch.HiddenInput />
            <Switch.Control />
          </Switch.Root>
        </SettingRow>

        <SettingRow
          title="Hide test files by default"
          description="Start the Changes tab's file list with test files hidden. Can still be toggled per PR with the checkbox above the file list."
        >
          <Switch.Root
            checked={hideTestFiles}
            onCheckedChange={(event) => toggleHideTestFiles(event.checked)}
            size="lg"
          >
            <Switch.HiddenInput />
            <Switch.Control />
          </Switch.Root>
        </SettingRow>
      </SettingsGroup>
    </SettingsPanel>
  );
}
