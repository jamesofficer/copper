import { createHash } from "node:crypto";
import type {
  FindingCategory,
  PullRequestFile,
  ReviewFinding,
  RiskSeverity,
} from "../../shared/types";

export const FINDING_CATEGORIES: FindingCategory[] = [
  "bug",
  "blast_radius",
  "edge_case",
  "security",
  "performance",
  "maintainability",
  "test_gap",
];

// The model's raw finding before validation — every field optional, since the
// tool input is only guaranteed to be an object.
export interface RawFinding {
  category?: string;
  severity?: string;
  title?: string;
  body?: string;
  path?: string;
  line?: number;
  suggestion?: string;
  lead?: number | null;
}

// Short stable hash used for finding and risk identities.
export function contentId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 12);
}

// The set of new-file line numbers that actually appear in a file's diff
// (added + context lines) — the only lines a review comment can anchor to.
function validNewLines(patch: string | null): number[] {
  if (!patch) return [];
  const lines: number[] = [];
  let newNumber = 0;
  for (const raw of patch.split("\n")) {
    if (raw.startsWith("@@")) {
      const match = raw.match(/\+(\d+)/);
      if (match) newNumber = Number(match[1]);
      continue;
    }
    if (raw.startsWith("-") || raw.startsWith("\\")) continue;
    if (raw.startsWith("+") || raw.length === 0 || raw.startsWith(" ")) {
      lines.push(newNumber);
      newNumber++;
    }
  }
  return lines;
}

function nearest(target: number, candidates: number[]): number | null {
  if (candidates.length === 0) return null;
  let best = candidates[0];
  for (const line of candidates) {
    if (Math.abs(line - target) < Math.abs(best - target)) best = line;
  }
  return best;
}

const severities: readonly string[] = ["low", "medium", "high"];

function toSeverity(value: string | undefined): RiskSeverity {
  return severities.includes(value ?? "") ? (value as RiskSeverity) : "medium";
}

function toCategory(value: string | undefined): FindingCategory {
  return FINDING_CATEGORIES.includes(value as FindingCategory)
    ? (value as FindingCategory)
    : "bug";
}

function findingId(
  category: FindingCategory,
  path: string,
  line: number,
): string {
  return contentId(`${category}|${path}|${line}`);
}

// Validates every finding against the diff: the path must be a changed file
// and the line must sit in its diff (snapped to the nearest in-diff line if
// the model was slightly off). Findings that can't be anchored are dropped —
// a finding you can't turn into a comment isn't useful here. Deduped by
// stable id so the same issue never appears twice.
export function normalizeFindings(
  raw: RawFinding[],
  files: PullRequestFile[],
): ReviewFinding[] {
  const linesByPath = new Map<string, number[]>(
    files.map((file) => [file.path, validNewLines(file.patch)]),
  );
  const seen = new Set<string>();
  const findings: ReviewFinding[] = [];

  for (const item of raw) {
    const path = item.path?.trim();
    const body = item.body?.trim();
    const title = item.title?.trim();
    if (!path || !body || !title) continue;
    const valid = linesByPath.get(path);
    if (!valid || valid.length === 0) continue;
    const requested = typeof item.line === "number" ? item.line : 0;
    const line = valid.includes(requested)
      ? requested
      : nearest(requested, valid);
    if (line === null) continue;

    const category = toCategory(item.category);
    const id = findingId(category, path, line);
    if (seen.has(id)) continue;
    seen.add(id);

    findings.push({
      id,
      category,
      severity: toSeverity(item.severity),
      title,
      body,
      path,
      line,
      suggestion: item.suggestion?.trim() || body,
      // Not part of the identity hash, so a re-run keeps stable ids.
      lead: typeof item.lead === "number" ? item.lead : null,
    });
  }

  // Sort high → medium → low so the scariest surfaces first.
  const rank: Record<RiskSeverity, number> = { high: 0, medium: 1, low: 2 };
  return findings.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
