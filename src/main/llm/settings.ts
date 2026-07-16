import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  ClaudeCodeStatus,
  LlmProvider,
  LlmProviderChoice,
  LlmStatus,
} from "../../shared/types";
import { getSecret } from "../store/secrets";

const configDir = join(homedir(), ".pr-reviewer");
const settingsPath = join(configDir, "settings.json");

interface AppSettings {
  llmProvider?: LlmProviderChoice;
}

async function readSettings(): Promise<AppSettings> {
  try {
    return JSON.parse(await readFile(settingsPath, "utf8")) as AppSettings;
  } catch {
    return {};
  }
}

async function writeSettings(settings: AppSettings): Promise<void> {
  await mkdir(configDir, { recursive: true });
  await writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

// Claude Code keeps non-secret account metadata in ~/.claude.json — presence
// of oauthAccount means the CLI is logged in on this machine. The credentials
// themselves live in the keychain (macOS) or ~/.claude/.credentials.json and
// are never read here.
export async function getClaudeCodeStatus(): Promise<ClaudeCodeStatus> {
  try {
    const raw = JSON.parse(
      await readFile(join(homedir(), ".claude.json"), "utf8"),
    ) as { oauthAccount?: { emailAddress?: unknown } };
    const email = raw.oauthAccount?.emailAddress;
    if (raw.oauthAccount) {
      return {
        available: true,
        account: typeof email === "string" ? email : null,
      };
    }
  } catch {
    // No config file or unreadable JSON — fall through to the credential check.
  }
  try {
    await access(join(homedir(), ".claude", ".credentials.json"));
    return { available: true, account: null };
  } catch {
    return { available: false, account: null };
  }
}

export async function getLlmStatus(): Promise<LlmStatus> {
  const settings = await readSettings();
  const choice = settings.llmProvider ?? "auto";
  const claudeCode = await getClaudeCodeStatus();
  const apiKeyConfigured = Boolean(await getSecret("anthropic"));
  const effective: LlmProvider =
    choice === "auto"
      ? claudeCode.available
        ? "claude-code"
        : "api-key"
      : choice;
  return { choice, effective, claudeCode, apiKeyConfigured };
}

export async function setLlmProvider(
  choice: LlmProviderChoice,
): Promise<LlmStatus> {
  const settings = await readSettings();
  settings.llmProvider = choice;
  await writeSettings(settings);
  return getLlmStatus();
}

export async function getEffectiveLlmProvider(): Promise<LlmProvider> {
  return (await getLlmStatus()).effective;
}
