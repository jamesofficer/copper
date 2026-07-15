import {
  Badge,
  Button,
  Field,
  HStack,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { KeyTestResult, SecretProvider } from "../../../shared/types";

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
    help: "Powers PR summaries and the Q&A agent. Create one at console.anthropic.com.",
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
    <Stack gap="7">
      {PROVIDERS.map((provider) => {
        const configured = status?.[provider.id] ?? false;
        const result = results[provider.id];
        return (
          <Field.Root key={provider.id}>
            <HStack justifyContent="space-between" w="full">
              <Field.Label>{provider.label}</Field.Label>
              <Badge
                colorPalette={configured ? "green" : "gray"}
                variant="surface"
                size="xs"
              >
                {configured ? "Configured" : "Not set"}
              </Badge>
            </HStack>
            <HStack w="full">
              <Input
                type="password"
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
                onClick={() => save(provider.id)}
                loading={busy === provider.id}
                disabled={!values[provider.id].trim()}
              >
                Save
              </Button>
              {configured && (
                <Button
                  variant="outline"
                  colorPalette="red"
                  onClick={() => clear(provider.id)}
                  loading={busy === provider.id}
                >
                  Remove
                </Button>
              )}
            </HStack>
            {result ? (
              <Text fontSize="sm" color={result.ok ? "green.fg" : "fg.error"}>
                {result.message}
              </Text>
            ) : (
              <Field.HelperText>{provider.help}</Field.HelperText>
            )}
          </Field.Root>
        );
      })}
    </Stack>
  );
}
