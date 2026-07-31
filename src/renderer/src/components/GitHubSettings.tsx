import GitHubSessionSettings from "./GitHubSessionSettings";
import SecretKeyRow from "./SecretKeyRow";
import { SettingsGroup, SettingsPanel } from "./SettingsLayout";

interface Props {
  open: boolean;
}

// GitHub needs two separate things, which is why they sit together on their own
// tab: a token for the API, and a signed-in browser session for attachments
// (the one thing GitHub has no API for).
export default function GitHubSettings({ open }: Props) {
  return (
    <SettingsPanel
      title="GitHub"
      description="How the app reaches GitHub. Both are stored on this machine and never leave it."
    >
      <SettingsGroup>
        <SecretKeyRow
          provider="github"
          title="Personal access token"
          description="Needs repo scope. Used to load pull requests, diffs, and comments."
          placeholder="ghp_…"
          open={open}
        />
      </SettingsGroup>

      <SettingsGroup>
        <GitHubSessionSettings />
      </SettingsGroup>
    </SettingsPanel>
  );
}
