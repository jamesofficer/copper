import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { dialog } from "electron";
import type { Repository, Worktree } from "../../shared/types";

const run = promisify(execFile);

const configDir = join(homedir(), ".pr-reviewer");
const registryPath = join(configDir, "repositories.json");

async function readRegistry(): Promise<Repository[]> {
  try {
    return JSON.parse(await readFile(registryPath, "utf8")) as Repository[];
  } catch {
    return [];
  }
}

async function writeRegistry(repositories: Repository[]): Promise<void> {
  await mkdir(configDir, { recursive: true });
  await writeFile(registryPath, JSON.stringify(repositories, null, 2));
}

export function listRepositories(): Promise<Repository[]> {
  return readRegistry();
}

function slugFromRemoteUrl(remoteUrl: string): string | null {
  const match = remoteUrl.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/);
  return match ? match[1] : null;
}

async function detectSlug(repoPath: string): Promise<string | null> {
  try {
    const { stdout } = await run("git", [
      "-C",
      repoPath,
      "remote",
      "get-url",
      "origin",
    ]);
    return slugFromRemoteUrl(stdout.trim());
  } catch {
    return null;
  }
}

export async function addRepository(): Promise<Repository | null> {
  const result = await dialog.showOpenDialog({
    title: "Add repository",
    message: "Choose a local git repository",
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const path = result.filePaths[0];
  if (!existsSync(join(path, ".git"))) {
    throw new Error(
      `"${basename(path)}" is not a git repository. Choose a folder with a .git directory.`,
    );
  }

  const repository: Repository = {
    path,
    name: basename(path),
    slug: await detectSlug(path),
  };

  const repositories = await readRegistry();
  await writeRegistry([
    repository,
    ...repositories.filter((known) => known.path !== path),
  ]);
  return repository;
}

// The current branch of the registered checkout matching a GitHub slug —
// prefills the new-PR dialog. Null when the repo isn't registered locally
// or HEAD is detached.
export async function getLocalCheckoutBranch(
  slug: string,
): Promise<string | null> {
  const match = (await readRegistry()).find(
    (repo) => repo.slug?.toLowerCase() === slug.toLowerCase(),
  );
  if (!match) return null;

  try {
    const { stdout } = await run("git", [
      "-C",
      match.path,
      "symbolic-ref",
      "--short",
      "HEAD",
    ]);
    return stdout.trim();
  } catch {
    return null;
  }
}

// The repo's checkouts — the main worktree plus any linked worktrees, for the
// Current changes tab's worktree switcher. `-z` NUL-terminates every field so
// paths with newlines survive; entries are separated by a double NUL. Bare and
// prunable (directory deleted, not yet pruned) entries are skipped; [] on any
// failure just hides the switcher.
export async function listWorktrees(repoPath: string): Promise<Worktree[]> {
  let output: string;
  try {
    const { stdout } = await run("git", [
      "-C",
      repoPath,
      "worktree",
      "list",
      "--porcelain",
      "-z",
    ]);
    output = stdout;
  } catch {
    return [];
  }

  const worktrees: Worktree[] = [];
  let first = true;
  for (const entry of output.split("\0\0")) {
    const fields = entry.split("\0").filter(Boolean);
    if (fields.length === 0) continue;
    const isMain = first;
    first = false;

    let path: string | null = null;
    let branch: string | null = null;
    let skip = false;
    for (const field of fields) {
      if (field.startsWith("worktree ")) {
        path = field.slice("worktree ".length);
      } else if (field.startsWith("branch refs/heads/")) {
        branch = field.slice("branch refs/heads/".length);
      } else if (field === "bare" || field.startsWith("prunable")) {
        skip = true;
      }
    }
    if (!skip && path !== null) worktrees.push({ path, branch, isMain });
  }
  return worktrees;
}

// Persists a drag-reordered list. Unknown paths are ignored; registered
// repos missing from `paths` keep a spot at the end, so a stale renderer
// list can never drop repositories.
export async function reorderRepositories(
  paths: string[],
): Promise<Repository[]> {
  const byPath = new Map(
    (await readRegistry()).map((repo) => [repo.path, repo]),
  );
  const ordered: Repository[] = [];
  for (const path of paths) {
    const repo = byPath.get(path);
    if (repo) {
      ordered.push(repo);
      byPath.delete(path);
    }
  }
  ordered.push(...byPath.values());
  await writeRegistry(ordered);
  return ordered;
}

export async function removeRepository(path: string): Promise<Repository[]> {
  const repositories = (await readRegistry()).filter(
    (known) => known.path !== path,
  );
  await writeRegistry(repositories);
  return repositories;
}
