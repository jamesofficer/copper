import { Alert, Button } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { SecretProvider, SecretsStatus } from "../../../shared/types";

interface Props {
  settingsOpen: boolean;
  onOpenSettings(): void;
}

const secretLabels: Record<SecretProvider, string> = {
  anthropic: "Claude API key",
  github: "GitHub token",
};

export default function SetupBanner({ settingsOpen, onOpenSettings }: Props) {
  const [secrets, setSecrets] = useState<SecretsStatus | null>(null);

  useEffect(() => {
    if (settingsOpen) return;
    void window.api.getSecretsStatus().then(setSecrets);
  }, [settingsOpen]);

  const missingSecrets = secrets
    ? (Object.keys(secretLabels) as SecretProvider[]).filter(
        (provider) => !secrets[provider],
      )
    : [];

  if (missingSecrets.length === 0) return null;

  const missingList = missingSecrets
    .map((provider) => secretLabels[provider])
    .join(" and ");

  return (
    <Alert.Root status="warning" rounded="lg" w="full">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>
          {missingSecrets.length === 2
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
