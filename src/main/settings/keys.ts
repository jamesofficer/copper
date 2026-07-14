import type {
  KeyTestResult,
  SecretProvider,
  SecretsStatus,
} from "../../shared/types";
import { clearSecret, getSecretsStatus, setSecret } from "../store/secrets";

async function testAnthropicKey(key: string): Promise<KeyTestResult> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
    });
    if (res.ok) return { ok: true, message: "Key verified with Anthropic." };
    if (res.status === 401) {
      return { ok: false, message: "Anthropic rejected this key." };
    }
    return { ok: false, message: `Anthropic returned status ${res.status}.` };
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Network error.",
    };
  }
}

async function testGitHubToken(token: string): Promise<KeyTestResult> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "pr-reviewer",
      },
    });
    if (res.ok) {
      const user = (await res.json()) as { login?: string };
      return {
        ok: true,
        message: user.login
          ? `Connected to GitHub as ${user.login}.`
          : "Token verified with GitHub.",
      };
    }
    if (res.status === 401) {
      return { ok: false, message: "GitHub rejected this token." };
    }
    return { ok: false, message: `GitHub returned status ${res.status}.` };
  } catch (cause) {
    return {
      ok: false,
      message: cause instanceof Error ? cause.message : "Network error.",
    };
  }
}

export function getKeyStatus(): Promise<SecretsStatus> {
  return getSecretsStatus();
}

export async function saveKey(
  provider: SecretProvider,
  value: string,
): Promise<KeyTestResult> {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, message: "Enter a value first." };

  const result =
    provider === "anthropic"
      ? await testAnthropicKey(trimmed)
      : await testGitHubToken(trimmed);

  if (result.ok) await setSecret(provider, trimmed);
  return result;
}

export function clearKey(provider: SecretProvider): Promise<SecretsStatus> {
  return clearSecret(provider);
}
