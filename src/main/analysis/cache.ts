import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AnalysisResult, AnalyzedPullRequest } from "../../shared/types";

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

// The newest analysis for a PR regardless of which commit it was run on —
// used to surface a stale-but-useful analysis after the branch moves.
export async function getLatestAnalysis(
  repo: string,
  prNumber: number,
): Promise<AnalysisResult | undefined> {
  const store = await loadCache();
  let latest: AnalysisResult | undefined;
  for (const result of store.values()) {
    if (result.repo !== repo || result.prNumber !== prNumber) continue;
    if (!latest || result.analyzedAt > latest.analyzedAt) latest = result;
  }
  return latest;
}

// The cache is keyed by head SHA, so a re-analysed PR has an entry per
// analysed commit — collapse those to one entry per PR, newest first.
export async function listAnalyzedPullRequests(): Promise<
  AnalyzedPullRequest[]
> {
  const store = await loadCache();
  const newestByPr = new Map<string, AnalysisResult>();
  for (const result of store.values()) {
    const key = `${result.repo}#${result.prNumber}`;
    const existing = newestByPr.get(key);
    if (!existing || result.analyzedAt > existing.analyzedAt) {
      newestByPr.set(key, result);
    }
  }

  return [...newestByPr.values()]
    .sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt))
    .map(({ repo, prNumber, headSha, analyzedAt }) => ({
      repo,
      prNumber,
      headSha,
      analyzedAt,
    }));
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
