import { join } from "node:path";
import { homedir } from "node:os";

export function workspaceRoot(): string {
	return join(homedir(), ".pr-reviewer", "repos");
}

// TODO: blobless clone on first open, fetch on subsequent opens
export async function ensureRepo(repo: string): Promise<string> {
	throw new Error(`Repo workspace not implemented yet (${repo})`);
}
