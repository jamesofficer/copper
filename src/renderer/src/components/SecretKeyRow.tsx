import { Badge, Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { KeyTestResult, SecretProvider } from "../../../shared/types";
import { SettingRow } from "./SettingsLayout";

interface Props {
  provider: SecretProvider;
  title: string;
  description: string;
  placeholder: string;
  // Cleared whenever the dialog is reopened, so a stale test result from the
  // last visit doesn't greet the user.
  open: boolean;
}

// One stored secret: the field, its save/remove buttons, and the result of the
// live validation call the main process makes before saving.
export default function SecretKeyRow({
  provider,
  title,
  description,
  placeholder,
  open,
}: Props) {
  const queryClient = useQueryClient();
  const { data: status } = useQuery({
    queryKey: ["secretsStatus"],
    queryFn: () => window.api.getSecretsStatus(),
  });

  const [value, setValue] = useState("");
  const [result, setResult] = useState<KeyTestResult | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setResult(undefined);
  }, [open]);

  const configured = status?.[provider] ?? false;

  async function refreshAfterChange() {
    await queryClient.invalidateQueries({ queryKey: ["secretsStatus"] });
    if (provider === "github") {
      await queryClient.invalidateQueries({ queryKey: ["pullRequests"] });
    }
    if (provider === "anthropic") {
      await queryClient.invalidateQueries({ queryKey: ["llmStatus"] });
    }
  }

  async function save() {
    setBusy(true);
    const saved = await window.api.saveSecret(provider, value);
    setResult(saved);
    if (saved.ok) {
      setValue("");
      await refreshAfterChange();
    }
    setBusy(false);
  }

  async function clear() {
    setBusy(true);
    await window.api.clearSecret(provider);
    setResult(undefined);
    await refreshAfterChange();
    setBusy(false);
  }

  return (
    <SettingRow title={title} description={description} stacked>
      <Stack gap="2">
        <HStack w="full">
          <Input
            type="password"
            size="sm"
            fontFamily="mono"
            placeholder={configured ? "••••••••" : placeholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <Button
            size="sm"
            onClick={save}
            loading={busy}
            disabled={!value.trim()}
          >
            Save
          </Button>
          {configured && (
            <Button
              size="sm"
              variant="outline"
              colorPalette="red"
              onClick={clear}
              loading={busy}
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
            <Text fontSize="xs" color={result.ok ? "green.fg" : "fg.error"}>
              {result.message}
            </Text>
          )}
        </HStack>
      </Stack>
    </SettingRow>
  );
}
