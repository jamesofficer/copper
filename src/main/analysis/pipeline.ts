import type {
  AnalysisClaim,
  AnalysisResult,
  AnalysisUsage,
  ChangeGroup,
  ChangeGroupRisk,
  DiffAnchor,
  PullRequestDetail,
  PullRequestFile,
} from "../../shared/types";
import { getPullRequest, listPullRequestFiles } from "../github/client";
import { getSecret } from "../store/secrets";
import { getCachedAnalysis, setCachedAnalysis } from "./cache";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-8";
const MAX_OUTPUT_TOKENS = 8192;

// USD per million tokens for MODEL — update alongside it.
const INPUT_USD_PER_MTOK = 5;
const OUTPUT_USD_PER_MTOK = 25;

// Huge PRs get their patches truncated so the prompt stays a sane size; the
// model still sees every file's name, status, and line counts.
const PATCH_CHAR_LIMIT = 12_000;
const TOTAL_PATCH_BUDGET = 200_000;

const MECHANICAL_PATTERNS = [
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)Cargo\.lock$/,
  /(^|\/)Gemfile\.lock$/,
  /(^|\/)go\.sum$/,
  /\.min\.(js|css)$/,
  /\.snap$/,
];

const SYSTEM_PROMPT = `You are an expert code reviewer. Turn a pull request diff into a guided review: what changed, why, in what order to read it, and where the risk is.

Rules:
- summary: 2–4 plain-English sentences saying what this PR does and why — the description the author should have written. No hype, no hedging.
- groups: split the diff into logical change groups, ordered as a reading guide — the group a reviewer should read first comes first. Every changed file appears in exactly one group. Risk levels: "attention" = new or changed logic the reviewer must think carefully about; "routine" = ordinary changes worth reading but unlikely to hide problems; "mechanical" = renames, lockfiles, generated code, formatting — skimmable. Within a group, list files in the order they should be read.
- risks: concrete things that could break, each anchored to the exact file and line the claim is based on. Only risks visible in the diff — never invent generic concerns. Empty list if nothing stands out.
- behaviorChanges: what callers or users will experience differently after this merges, anchored the same way. Empty list if behavior is unchanged.
- Every risk and behavior change carries a title: a very short label (3–6 words) naming it for a navigation list, alongside the full text.
- outOfScope: related work this PR deliberately does NOT do — things a reviewer might expect but won't find. Short entries.
- Anchors use line numbers in the NEW version of the file, derived from the @@ hunk headers. Use null for a whole-file claim.
- Text fields render as GitHub-flavored markdown. Tag fenced code blocks with a language (\`\`\`ts, \`\`\`diff, …) so they get syntax highlighting.
- Never claim anything the diff does not show. If a patch is truncated or omitted, say less rather than guessing.`;

const anchorSchema = {
  type: "object",
  properties: {
    path: {
      type: "string",
      description: "File path exactly as it appears in the diff",
    },
    line: {
      type: ["integer", "null"],
      description:
        "Line number in the new version of the file, or null for a whole-file claim",
    },
  },
  required: ["path", "line"],
};

const claimSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Very short label (3–6 words) naming this claim",
    },
    text: { type: "string" },
    anchors: { type: "array", items: anchorSchema },
  },
  required: ["title", "text", "anchors"],
};

const analysisTool = {
  name: "report_analysis",
  description: "Report the structured review analysis of the pull request.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      groups: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            story: {
              type: "string",
              description:
                "One short paragraph: what this group changes and why",
            },
            risk: {
              type: "string",
              enum: ["attention", "routine", "mechanical"],
            },
            files: { type: "array", items: { type: "string" } },
          },
          required: ["title", "story", "risk", "files"],
        },
      },
      risks: { type: "array", items: claimSchema },
      behaviorChanges: { type: "array", items: claimSchema },
      outOfScope: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "groups", "risks", "behaviorChanges", "outOfScope"],
  },
};

interface RawAnchor {
  path?: string;
  line?: number | null;
}

interface RawClaim {
  title?: string;
  text?: string;
  anchors?: RawAnchor[];
}

interface RawGroup {
  title?: string;
  story?: string;
  risk?: string;
  files?: string[];
}

interface RawAnalysis {
  summary?: string;
  groups?: RawGroup[];
  risks?: RawClaim[];
  behaviorChanges?: RawClaim[];
  outOfScope?: string[];
}

// Cheap lookup used by the renderer to decide between showing a cached
// analysis and the "Analyse PR" empty state. Never calls the model.
export async function getExistingAnalysis(
  repo: string,
  prNumber: number,
): Promise<AnalysisResult | null> {
  const detail = await getPullRequest(repo, prNumber);
  return (await getCachedAnalysis(repo, prNumber, detail.headSha)) ?? null;
}

export async function analyzePullRequest(
  repo: string,
  prNumber: number,
): Promise<AnalysisResult> {
  const apiKey = await getSecret("anthropic");
  if (!apiKey) {
    throw new Error(
      "Connect a Claude API key in settings to analyse pull requests.",
    );
  }

  const detail = await getPullRequest(repo, prNumber);
  const cached = await getCachedAnalysis(repo, prNumber, detail.headSha);
  if (cached) return cached;

  const files = await listPullRequestFiles(repo, prNumber);
  const { raw, usage } = await requestAnalysis(
    apiKey,
    buildPullRequestContext(detail, files),
  );
  const result = toAnalysisResult(raw, detail, files, usage);
  await setCachedAnalysis(result);
  return result;
}

function isMechanical(path: string): boolean {
  return MECHANICAL_PATTERNS.some((pattern) => pattern.test(path));
}

function fileHeader(file: PullRequestFile): string {
  const rename = file.previousPath
    ? ` (renamed from ${file.previousPath})`
    : "";
  return `=== ${file.path}${rename} [${file.status}, +${file.additions}/-${file.deletions}]`;
}

function buildDiffSection(files: PullRequestFile[]): string {
  const sections: string[] = [];
  let budget = TOTAL_PATCH_BUDGET;

  for (const file of files) {
    const header = fileHeader(file);
    if (!file.patch || isMechanical(file.path)) {
      sections.push(`${header}\n(patch omitted)`);
      continue;
    }

    let patch = file.patch;
    if (patch.length > PATCH_CHAR_LIMIT) {
      patch = `${patch.slice(0, PATCH_CHAR_LIMIT)}\n… (patch truncated)`;
    }
    if (patch.length > budget) {
      sections.push(`${header}\n(patch omitted — prompt size limit)`);
      continue;
    }

    budget -= patch.length;
    sections.push(`${header}\n${patch}`);
  }

  return sections.join("\n\n");
}

// Also the chat's context block, so both features describe the PR the same way.
export function buildPullRequestContext(
  detail: PullRequestDetail,
  files: PullRequestFile[],
): string {
  return [
    `Repository: ${detail.repo}`,
    `Pull request #${detail.number}: ${detail.title}`,
    `Author: ${detail.author}`,
    `Merging ${detail.headRef} into ${detail.baseRef}`,
    `${detail.commits} commits, ${detail.changedFiles} files, +${detail.additions}/-${detail.deletions}`,
    "",
    "Author's description:",
    detail.body?.trim() || "(no description provided)",
    "",
    `Diff (${files.length} files):`,
    "",
    buildDiffSection(files),
  ].join("\n");
}

async function requestAnalysis(
  apiKey: string,
  prompt: string,
): Promise<{ raw: RawAnalysis; usage: AnalysisUsage | undefined }> {
  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      tools: [analysisTool],
      tool_choice: { type: "tool", name: "report_analysis" },
    }),
  });

  if (res.status === 401) {
    throw new Error(
      "Anthropic rejected your API key. Re-check it in settings.",
    );
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = body.error?.message ?? "";
    } catch {
      // Non-JSON error body; fall back to the status code.
    }
    throw new Error(
      detail
        ? `Anthropic error: ${detail}`
        : `Anthropic returned status ${res.status}.`,
    );
  }

  const message = (await res.json()) as {
    content: Array<{ type: string; input?: unknown }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse?.input) {
    throw new Error("The model returned no analysis. Try again.");
  }

  const inputTokens = message.usage?.input_tokens ?? 0;
  const outputTokens = message.usage?.output_tokens ?? 0;
  const usage: AnalysisUsage | undefined = message.usage
    ? {
        inputTokens,
        outputTokens,
        costUsd:
          (inputTokens * INPUT_USD_PER_MTOK +
            outputTokens * OUTPUT_USD_PER_MTOK) /
          1_000_000,
      }
    : undefined;

  return { raw: toolUse.input as RawAnalysis, usage };
}

const riskLevels: readonly string[] = ["attention", "routine", "mechanical"];

function toRisk(value: string | undefined): ChangeGroupRisk {
  return riskLevels.includes(value ?? "")
    ? (value as ChangeGroupRisk)
    : "routine";
}

function slugify(title: string, index: number, seen: Set<string>): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `group-${index + 1}`;
  const id = seen.has(base) ? `${base}-${index + 1}` : base;
  seen.add(id);
  return id;
}

function normalizeAnchors(
  anchors: RawAnchor[] | undefined,
  validPaths: Set<string>,
): DiffAnchor[] {
  return (anchors ?? [])
    .filter((anchor) => anchor.path && validPaths.has(anchor.path))
    .map((anchor) => ({
      path: anchor.path as string,
      line: typeof anchor.line === "number" ? anchor.line : null,
    }));
}

function fallbackTitle(text: string): string {
  const words = text.trim().split(/\s+/);
  return words.slice(0, 6).join(" ") + (words.length > 6 ? "…" : "");
}

function normalizeClaims(
  claims: RawClaim[] | undefined,
  validPaths: Set<string>,
): AnalysisClaim[] {
  return (claims ?? [])
    .filter((claim) => claim.text?.trim())
    .map((claim) => ({
      title: claim.title?.trim() || fallbackTitle(claim.text as string),
      text: (claim.text as string).trim(),
      anchors: normalizeAnchors(claim.anchors, validPaths),
    }));
}

function toAnalysisResult(
  raw: RawAnalysis,
  detail: PullRequestDetail,
  files: PullRequestFile[],
  usage: AnalysisUsage | undefined,
): AnalysisResult {
  const validPaths = new Set(files.map((file) => file.path));
  const seenIds = new Set<string>();

  const groups: ChangeGroup[] = (raw.groups ?? [])
    .map((group, index) => ({
      id: slugify(group.title ?? "", index, seenIds),
      title: group.title?.trim() || `Change ${index + 1}`,
      story: group.story?.trim() ?? "",
      risk: toRisk(group.risk),
      files: (group.files ?? []).filter((path) => validPaths.has(path)),
    }))
    .filter((group) => group.files.length > 0);

  // Every file must land somewhere, so the review provably covers the whole
  // diff even if the model missed a few.
  const grouped = new Set(groups.flatMap((group) => group.files));
  const ungrouped = files
    .map((file) => file.path)
    .filter((path) => !grouped.has(path));
  if (ungrouped.length > 0) {
    groups.push({
      id: "everything-else",
      title: "Everything else",
      story: "Files the analysis didn't place in a group.",
      risk: "routine",
      files: ungrouped,
    });
  }

  return {
    repo: detail.repo,
    prNumber: detail.number,
    headSha: detail.headSha,
    model: MODEL,
    analyzedAt: new Date().toISOString(),
    usage,
    summary: raw.summary?.trim() || "The analysis returned no summary.",
    groups,
    risks: normalizeClaims(raw.risks, validPaths),
    behaviorChanges: normalizeClaims(raw.behaviorChanges, validPaths),
    outOfScope: (raw.outOfScope ?? [])
      .map((entry) => entry?.trim())
      .filter((entry): entry is string => Boolean(entry)),
  };
}
