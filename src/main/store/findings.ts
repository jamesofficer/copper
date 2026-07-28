import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { FindingResolution, FindingsResult } from "../../shared/types";

// Disk-backed so paid findings runs survive restarts. Two files: the runs
// themselves (keyed repo#pr@sha, one per analysed commit) and the user's
// per-finding resolutions (keyed repo#pr, kept across re-runs so a dismissed
// or accepted finding never nags again). TODO: fold into SQLite later.
const configDir = join(homedir(), ".pr-reviewer");
const runsPath = join(configDir, "findings.json");
const resolutionsPath = join(configDir, "finding-resolutions.json");
const MAX_ENTRIES = 100;

let runs: Map<string, FindingsResult> | null = null;
let resolutions: Map<string, Record<string, FindingResolution>> | null = null;

function runKey(repo: string, prNumber: number, headSha: string): string {
  return `${repo}#${prNumber}@${headSha}`;
}

function prKey(repo: string, prNumber: number): string {
  return `${repo}#${prNumber}`;
}

async function loadRuns(): Promise<Map<string, FindingsResult>> {
  if (runs) return runs;
  try {
    const raw = JSON.parse(await readFile(runsPath, "utf8")) as Record<
      string,
      FindingsResult
    >;
    runs = new Map(Object.entries(raw));
  } catch {
    runs = new Map();
  }
  return runs;
}

async function loadResolutions(): Promise<
  Map<string, Record<string, FindingResolution>>
> {
  if (resolutions) return resolutions;
  try {
    const raw = JSON.parse(await readFile(resolutionsPath, "utf8")) as Record<
      string,
      Record<string, FindingResolution>
    >;
    resolutions = new Map(Object.entries(raw));
  } catch {
    resolutions = new Map();
  }
  return resolutions;
}

async function persist(path: string, store: Map<string, unknown>) {
  await mkdir(configDir, { recursive: true });
  await writeFile(path, JSON.stringify(Object.fromEntries(store), null, 2));
}

// The PR's saved resolutions, keyed by issue id. Shared by findings and the
// analysis's risks — both join their resolution from here at read time.
export async function getResolutions(
  repo: string,
  prNumber: number,
): Promise<Record<string, FindingResolution>> {
  return (await loadResolutions()).get(prKey(repo, prNumber)) ?? {};
}

// Joins a stored run with the PR's resolutions, so each finding carries what
// the user did with it. A run never stores resolutions itself — they live per
// PR and outlast any single run.
function withResolutions(
  result: FindingsResult,
  resolved: Record<string, FindingResolution>,
): FindingsResult {
  return {
    ...result,
    findings: result.findings.map((finding) => ({
      ...finding,
      resolution: resolved[finding.id],
    })),
  };
}

export async function getCachedFindings(
  repo: string,
  prNumber: number,
  headSha: string,
): Promise<FindingsResult | undefined> {
  const store = await loadRuns();
  const run = store.get(runKey(repo, prNumber, headSha));
  if (!run) return undefined;
  return withResolutions(run, await getResolutions(repo, prNumber));
}

// The newest run for a PR regardless of commit — surfaces a stale-but-useful
// findings run after the branch moves, like getLatestAnalysis.
export async function getLatestFindings(
  repo: string,
  prNumber: number,
): Promise<FindingsResult | undefined> {
  const store = await loadRuns();
  let latest: FindingsResult | undefined;
  for (const run of store.values()) {
    if (run.repo !== repo || run.prNumber !== prNumber) continue;
    if (!latest || run.ranAt > latest.ranAt) latest = run;
  }
  if (!latest) return undefined;
  return withResolutions(latest, await getResolutions(repo, prNumber));
}

export async function setCachedFindings(
  result: FindingsResult,
): Promise<FindingsResult> {
  const store = await loadRuns();
  store.set(runKey(result.repo, result.prNumber, result.headSha), result);

  // Drop the oldest runs once the cache grows past the cap.
  if (store.size > MAX_ENTRIES) {
    const byAge = [...store.entries()].sort((a, b) =>
      a[1].ranAt.localeCompare(b[1].ranAt),
    );
    for (const [key] of byAge.slice(0, store.size - MAX_ENTRIES)) {
      store.delete(key);
    }
  }
  await persist(runsPath, store);

  return withResolutions(
    result,
    await getResolutions(result.repo, result.prNumber),
  );
}

// Sets or clears a finding's resolution. "open" clears it (a restore); the
// key is the finding's stable id, so it applies to that issue across re-runs.
export async function setFindingResolution(
  repo: string,
  prNumber: number,
  findingId: string,
  resolution: FindingResolution | "open",
): Promise<void> {
  const store = await loadResolutions();
  const key = prKey(repo, prNumber);
  const current = { ...(store.get(key) ?? {}) };
  if (resolution === "open") delete current[findingId];
  else current[findingId] = resolution;
  if (Object.keys(current).length > 0) store.set(key, current);
  else store.delete(key);
  await persist(resolutionsPath, store);
}
