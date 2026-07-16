import {
  createListCollection,
  Field,
  Select,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_MODELS, MODEL_OPTIONS } from "../../../shared/models";
import type { LlmTask } from "../../../shared/types";

const modelCollection = createListCollection({
  items: MODEL_OPTIONS.map((option) => ({
    label: option.label,
    value: option.id,
    description: option.description,
  })),
});

interface TaskConfig {
  task: LlmTask;
  label: string;
  help: string;
}

const TASKS: TaskConfig[] = [
  {
    task: "analysis",
    label: "Analysis model",
    help: "Reads the whole diff and builds the guided review. Bigger models give deeper analyses.",
  },
  {
    task: "chat",
    label: "Chat model",
    help: "Answers questions in the review chat. Smaller models respond faster.",
  },
];

// Picks which Claude model each feature runs on, for both providers.
export default function ModelSettings() {
  const queryClient = useQueryClient();
  const { data: status } = useQuery({
    queryKey: ["llmStatus"],
    queryFn: () => window.api.getLlmStatus(),
  });

  const mutation = useMutation({
    mutationFn: ({ task, model }: { task: LlmTask; model: string }) =>
      window.api.setLlmModel(task, model),
    onSuccess: (updated) => {
      queryClient.setQueryData(["llmStatus"], updated);
    },
  });

  return (
    <Stack gap="5">
      {TASKS.map(({ task, label, help }) => (
        <Field.Root key={task}>
          <Field.Label>{label}</Field.Label>
          <Select.Root
            collection={modelCollection}
            value={[status?.models[task] ?? DEFAULT_MODELS[task]]}
            onValueChange={(details) => {
              const model = details.value[0];
              if (model) mutation.mutate({ task, model });
            }}
            size="sm"
            maxW="56"
            disabled={!status}
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
                {modelCollection.items.map((item) => (
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
          <Field.HelperText>{help}</Field.HelperText>
        </Field.Root>
      ))}
    </Stack>
  );
}
