import { getSecret } from "../store/secrets";

// TODO: add GitHub OAuth device flow as an alternative to a pasted token.
export function getGitHubToken(): Promise<string | null> {
  return getSecret("github");
}
