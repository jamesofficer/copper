import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AnalysisResult } from "../../shared/types";

// Disk-backed so paid analyses survive app restarts. TODO: move to SQLite
// once more data needs persisting.
const configDir = join(homedir(), ".pr-reviewer");
const cachePath = join(configDir, "analyses.json");
const MAX_ENTRIES = 100;

let cache: Map<string, AnalysisResult> | null = null;

function cacheKey(repo: string, prNumber: number, headSha: string): string {
  return `${repo}#${prNumber}@${headSha}`;
}

async function loadCache(): Promise<Map<string, AnalysisResult>> {
  if (cache) return cache;
  try {
    const raw = JSON.parse(await readFile(cachePath, "utf8")) as Record<
      string,
      AnalysisResult
    >;
    cache = new Map(Object.entries(raw));
  } catch {
    cache = new Map();
  }
  return cache;
}

async function persist(store: Map<string, AnalysisResult>): Promise<void> {
  await mkdir(configDir, { recursive: true });
  await writeFile(
    cachePath,
    JSON.stringify(Object.fromEntries(store), null, 2),
  );
}

export async function getCachedAnalysis(
  repo: string,
  prNumber: number,
  headSha: string,
): Promise<AnalysisResult | undefined> {
  const store = await loadCache();
  return store.get(cacheKey(repo, prNumber, headSha));
}

export async function setCachedAnalysis(result: AnalysisResult): Promise<void> {
  const store = await loadCache();
  store.set(cacheKey(result.repo, result.prNumber, result.headSha), result);

  // Drop the oldest analyses once the cache grows past the cap.
  if (store.size > MAX_ENTRIES) {
    const byAge = [...store.entries()].sort((a, b) =>
      a[1].analyzedAt.localeCompare(b[1].analyzedAt),
    );
    for (const [key] of byAge.slice(0, store.size - MAX_ENTRIES)) {
      store.delete(key);
    }
  }

  await persist(store);
}
