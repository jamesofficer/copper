import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { safeStorage } from "electron";
import type { SecretProvider, SecretsStatus } from "../../shared/types";

const configDir = join(homedir(), ".pr-reviewer");
const secretsPath = join(configDir, "secrets.json");

type SecretStore = Partial<Record<SecretProvider, string>>;

async function readStore(): Promise<SecretStore> {
  try {
    return JSON.parse(await readFile(secretsPath, "utf8")) as SecretStore;
  } catch {
    return {};
  }
}

async function writeStore(store: SecretStore): Promise<void> {
  await mkdir(configDir, { recursive: true });
  await writeFile(secretsPath, JSON.stringify(store, null, 2));
}

export async function getSecretsStatus(): Promise<SecretsStatus> {
  // Decrypt rather than just check presence, so an undecryptable key reports
  // as not set instead of silently failing on first use.
  return {
    anthropic: Boolean(await getSecret("anthropic")),
    github: Boolean(await getSecret("github")),
  };
}

export async function setSecret(
  provider: SecretProvider,
  value: string,
): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure storage is not available on this system.");
  }
  const store = await readStore();
  store[provider] = safeStorage.encryptString(value).toString("base64");
  await writeStore(store);
}

export async function clearSecret(
  provider: SecretProvider,
): Promise<SecretsStatus> {
  const store = await readStore();
  delete store[provider];
  await writeStore(store);
  return getSecretsStatus();
}

// Main-process only — never exposed over IPC, so raw keys stay out of the renderer.
export async function getSecret(
  provider: SecretProvider,
): Promise<string | null> {
  const store = await readStore();
  const encrypted = store[provider];
  if (!encrypted) return null;
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  } catch {
    // Can't decrypt right now — often transient (keychain locked, or access
    // denied to this launch of the app). Keep the ciphertext: deleting here
    // turns a temporary failure into permanent key loss. The key reports as
    // not set until it decrypts again or the user saves a new one.
    return null;
  }
}
