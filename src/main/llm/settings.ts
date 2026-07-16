import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_MODELS, isKnownModel } from "../../shared/models";
import type {
  ClaudeCodeStatus,
  LlmProvider,
  LlmProviderChoice,
  LlmStatus,
  LlmTask,
} from "../../shared/types";
import { getSecret } from "../store/secrets";

const configDir = join(homedir(), ".pr-reviewer");
const settingsPath = join(configDir, "settings.json");

interface AppSettings {
  llmProvider?: LlmProviderChoice;
  models?: Partial<Record<LlmTask, string>>;
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

// Stored ids that are no longer in the catalog fall back to the default.
function resolveModels(settings: AppSettings): Record<LlmTask, string> {
  const models = { ...DEFAULT_MODELS };
  for (const task of Object.keys(models) as LlmTask[]) {
    const stored = settings.models?.[task];
    if (stored && isKnownModel(stored)) models[task] = stored;
  }
  return models;
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
  return {
    choice,
    effective,
    claudeCode,
    apiKeyConfigured,
    models: resolveModels(settings),
  };
}

export async function setLlmProvider(
  choice: LlmProviderChoice,
): Promise<LlmStatus> {
  const settings = await readSettings();
  settings.llmProvider = choice;
  await writeSettings(settings);
  return getLlmStatus();
}

export async function setLlmModel(
  task: LlmTask,
  model: string,
): Promise<LlmStatus> {
  if (!isKnownModel(model)) {
    throw new Error(`Unknown model: ${model}`);
  }
  const settings = await readSettings();
  settings.models = { ...settings.models, [task]: model };
  await writeSettings(settings);
  return getLlmStatus();
}

export async function getLlmModel(task: LlmTask): Promise<string> {
  return resolveModels(await readSettings())[task];
}

export async function getEffectiveLlmProvider(): Promise<LlmProvider> {
  return (await getLlmStatus()).effective;
}
