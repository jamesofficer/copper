import LlmProviderSettings from "./LlmProviderSettings";
import SecretKeyRow from "./SecretKeyRow";
import { SettingRow, SettingsGroup, SettingsPanel } from "./SettingsLayout";

interface Props {
  open: boolean;
}

// Claude access only — GitHub has its own tab.
export default function ApiKeysSettings({ open }: Props) {
  return (
    <SettingsPanel
      title="Connections"
      description="How the app reaches Claude. Keys are encrypted on this machine and never leave it."
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
        <SecretKeyRow
          provider="anthropic"
          title="Claude API key"
          description="Used when Claude access is set to API key. Create one at console.anthropic.com."
          placeholder="sk-ant-…"
          open={open}
        />
      </SettingsGroup>
    </SettingsPanel>
  );
}
