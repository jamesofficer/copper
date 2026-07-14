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
  // Decrypt rather than just check presence — getSecret drops entries that
  // can no longer be decrypted, so stale keys report as not set.
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
    // Undecryptable (e.g. the encryption key changed when the app was
    // renamed) — drop it so the app treats the key as not set.
    delete store[provider];
    await writeStore(store);
    return null;
  }
}
