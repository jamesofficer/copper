import { Badge, Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { KeyTestResult, SecretProvider } from "../../../shared/types";
import LlmProviderSettings from "./LlmProviderSettings";
import { SettingRow, SettingsGroup, SettingsPanel } from "./SettingsLayout";

interface Props {
  open: boolean;
}

interface ProviderConfig {
  id: SecretProvider;
  label: string;
  help: string;
  placeholder: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "anthropic",
    label: "Claude API key",
    help: "Used when Claude access is set to API key. Create one at console.anthropic.com.",
    placeholder: "sk-ant-…",
  },
  {
    id: "github",
    label: "GitHub token",
    help: "A personal access token with repo scope, used to load pull requests.",
    placeholder: "ghp_…",
  },
];

type ResultMap = Partial<Record<SecretProvider, KeyTestResult>>;

export default function ApiKeysSettings({ open }: Props) {
  const queryClient = useQueryClient();
  const { data: status } = useQuery({
    queryKey: ["secretsStatus"],
    queryFn: () => window.api.getSecretsStatus(),
  });
  const [values, setValues] = useState<Record<SecretProvider, string>>({
    anthropic: "",
    github: "",
  });
  const [results, setResults] = useState<ResultMap>({});
  const [busy, setBusy] = useState<SecretProvider | null>(null);

  useEffect(() => {
    if (open) setResults({});
  }, [open]);

  async function refreshAfterChange(provider: SecretProvider) {
    await queryClient.invalidateQueries({ queryKey: ["secretsStatus"] });
    if (provider === "github") {
      await queryClient.invalidateQueries({ queryKey: ["pullRequests"] });
    }
    if (provider === "anthropic") {
      await queryClient.invalidateQueries({ queryKey: ["llmStatus"] });
    }
  }

  async function save(provider: SecretProvider) {
    setBusy(provider);
    const result = await window.api.saveSecret(provider, values[provider]);
    setResults((prev) => ({ ...prev, [provider]: result }));
    if (result.ok) {
      setValues((prev) => ({ ...prev, [provider]: "" }));
      await refreshAfterChange(provider);
    }
    setBusy(null);
  }

  async function clear(provider: SecretProvider) {
    setBusy(provider);
    await window.api.clearSecret(provider);
    setResults((prev) => ({ ...prev, [provider]: undefined }));
    await refreshAfterChange(provider);
    setBusy(null);
  }

  return (
    <SettingsPanel
      title="Connections"
      description="How the app reaches Claude and GitHub. Keys are encrypted on this machine and never leave it."
    >
      <SettingsGroup>
        <SettingRow
          title="Claude access"
          description="Run on your Claude Code login, or on an API key."
          stacked
        >
          <LlmProviderSettings />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup>
        {PROVIDERS.map((provider) => {
          const configured = status?.[provider.id] ?? false;
          const result = results[provider.id];
          return (
            <SettingRow
              key={provider.id}
              title={provider.label}
              description={provider.help}
              stacked
            >
              <Stack gap="2">
                <HStack w="full">
                  <Input
                    type="password"
                    size="sm"
                    fontFamily="mono"
                    placeholder={configured ? "••••••••" : provider.placeholder}
                    value={values[provider.id]}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        [provider.id]: event.target.value,
                      }))
                    }
                  />
                  <Button
                    size="sm"
                    onClick={() => save(provider.id)}
                    loading={busy === provider.id}
                    disabled={!values[provider.id].trim()}
                  >
                    Save
                  </Button>
                  {configured && (
                    <Button
                      size="sm"
                      variant="outline"
                      colorPalette="red"
                      onClick={() => clear(provider.id)}
                      loading={busy === provider.id}
                    >
                      Remove
                    </Button>
                  )}
                </HStack>
                <HStack gap="2">
                  <Badge
                    colorPalette={configured ? "green" : "gray"}
                    variant="surface"
                    size="xs"
                  >
                    {configured ? "Configured" : "Not set"}
                  </Badge>
                  {result && (
                    <Text
                      fontSize="xs"
                      color={result.ok ? "green.fg" : "fg.error"}
                    >
                      {result.message}
                    </Text>
                  )}
                </HStack>
              </Stack>
            </SettingRow>
          );
        })}
      </SettingsGroup>
    </SettingsPanel>
  );
}
