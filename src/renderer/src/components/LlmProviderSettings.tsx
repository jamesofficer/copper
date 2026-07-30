import { Box, HStack, RadioCard, Stack, Text } from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LuCircleAlert, LuInfo } from "react-icons/lu";
import type { LlmProviderChoice, LlmStatus } from "../../../shared/types";

interface Choice {
  value: LlmProviderChoice;
  label: string;
  description: string;
}

const CHOICES: Choice[] = [
  {
    value: "auto",
    label: "Automatic",
    description: "Claude Code when it's logged in, otherwise your API key.",
  },
  {
    value: "claude-code",
    label: "Claude Code",
    description: "Runs on your Claude plan — no API charges.",
  },
  {
    value: "api-key",
    label: "API key",
    description: "Direct API calls, billed per token.",
  },
];

function statusLine(status: LlmStatus): { text: string; warn: boolean } {
  if (status.effective === "claude-code") {
    if (!status.claudeCode.available) {
      return {
        text: "Claude Code isn't set up on this machine — install it and run `claude` in a terminal to log in.",
        warn: true,
      };
    }
    return {
      text: status.claudeCode.account
        ? `Using Claude Code, logged in as ${status.claudeCode.account}.`
        : "Using Claude Code.",
      warn: false,
    };
  }
  if (!status.apiKeyConfigured) {
    return { text: "Using an API key — add one below.", warn: true };
  }
  return { text: "Using your Claude API key.", warn: false };
}

// Picks how the app talks to Claude: the local Claude Code login (plan
// billing) or a raw API key (per-token billing).
export default function LlmProviderSettings() {
  const queryClient = useQueryClient();
  const { data: status } = useQuery({
    queryKey: ["llmStatus"],
    queryFn: () => window.api.getLlmStatus(),
  });

  const mutation = useMutation({
    mutationFn: (choice: LlmProviderChoice) =>
      window.api.setLlmProvider(choice),
    onSuccess: (updated) => {
      queryClient.setQueryData(["llmStatus"], updated);
    },
  });

  const line = status ? statusLine(status) : null;

  return (
    <Stack gap="3">
      <RadioCard.Root
        value={status?.choice ?? "auto"}
        onValueChange={(details) => {
          if (details.value)
            mutation.mutate(details.value as LlmProviderChoice);
        }}
        disabled={!status}
        size="sm"
        variant="surface"
      >
        <HStack alignItems="stretch" gap="2">
          {CHOICES.map((choice) => (
            <RadioCard.Item key={choice.value} value={choice.value} flex="1">
              <RadioCard.ItemHiddenInput />
              <RadioCard.ItemControl cursor="pointer">
                <RadioCard.ItemContent>
                  <RadioCard.ItemText fontSize="sm">
                    {choice.label}
                  </RadioCard.ItemText>
                  <RadioCard.ItemDescription fontSize="xs" lineHeight="1.4">
                    {choice.description}
                  </RadioCard.ItemDescription>
                </RadioCard.ItemContent>
              </RadioCard.ItemControl>
            </RadioCard.Item>
          ))}
        </HStack>
      </RadioCard.Root>
      {line && (
        <HStack
          gap="2"
          alignItems="flex-start"
          color={line.warn ? "orange.fg" : "fg.muted"}
        >
          <Box mt="0.5" flexShrink="0">
            {line.warn ? <LuCircleAlert size={14} /> : <LuInfo size={14} />}
          </Box>
          <Text fontSize="xs" lineHeight="1.5">
            {line.text}
          </Text>
        </HStack>
      )}
    </Stack>
  );
}
