import { Alert, Button } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";

interface Props {
  onOpenSettings(): void;
}

export default function SetupBanner({ onOpenSettings }: Props) {
  const { data: secrets } = useQuery({
    queryKey: ["secretsStatus"],
    queryFn: () => window.api.getSecretsStatus(),
  });
  const { data: llm } = useQuery({
    queryKey: ["llmStatus"],
    queryFn: () => window.api.getLlmStatus(),
  });

  if (!secrets || !llm) return null;

  const missing: string[] = [];
  // Claude Code covers the Claude side without a key.
  if (llm.effective === "api-key" && !secrets.anthropic) {
    missing.push("Claude API key");
  }
  if (!secrets.github) missing.push("GitHub token");

  if (missing.length === 0) return null;

  const missingList = missing.join(" and ");

  return (
    <Alert.Root status="warning" rounded="lg" w="full">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>
          {missing.length === 2
            ? "Connect your API keys"
            : `Add your ${missingList}`}
        </Alert.Title>
        <Alert.Description>
          Set your {missingList} in settings to load pull requests and run
          reviews.
        </Alert.Description>
      </Alert.Content>
      <Button
        size="sm"
        variant="surface"
        alignSelf="center"
        flexShrink="0"
        onClick={onOpenSettings}
      >
        Open settings
      </Button>
    </Alert.Root>
  );
}
