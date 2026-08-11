import type {
  AnalysisClaim,
  AnalysisResult,
  AnalysisUsage,
  ChangeGroup,
  ChangeGroupRisk,
  DiffAnchor,
  FindingResolution,
  PullRequestDetail,
  PullRequestFile,
  ReviewPersonality,
  RiskClaim,
  RiskSeverity,
} from "../../shared/types";
import { getPullRequest, listPullRequestFiles } from "../github/client";
import { runStructuredQuery } from "../llm/claudeCode";
import { getEffectiveLlmProvider, getLlmModel } from "../llm/settings";
import { getResolutions } from "../store/findings";
import { getSecret } from "../store/secrets";
import {
  getCachedAnalysis,
  getLatestAnalysis,
  setCachedAnalysis,
} from "./cache";
import { contentId } from "./findingsNormalize";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MAX_OUTPUT_TOKENS = 16_384;

// USD per million tokens by model id — update alongside the model catalog in
// shared/models.ts. Unknown models get no cost estimate rather than a wrong one.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

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
- summary: 2–4 plain-English sentences saying what this PR does and why — the description the author should have written. No hype, no hedging. Prose only: never embed JSON or repeat the other fields' content inside it.
- groups: split the diff into logical change groups, ordered as a reading guide — the group a reviewer should read first comes first. Every changed file appears in exactly one group. Use as many or as few groups as the change naturally splits into — don't merge unrelated changes to keep the list short. Risk levels: "attention" = new or changed logic the reviewer must think carefully about; "routine" = ordinary changes worth reading but unlikely to hide problems; "mechanical" = renames, lockfiles, generated code, formatting — skimmable. Within a group, list files in the order they should be read.
- risks: concrete things that could break, each anchored to the exact file and line the claim is based on. Only risks visible in the diff — never invent generic concerns. Empty list if nothing stands out.
- Every risk carries a severity: "high" = could plausibly break production, lose data, or open a security hole; "medium" = a real bug or regression is plausible and worth checking; "low" = unlikely to bite or low-impact if it does. Judge each risk on its own — don't grade on a curve to get a spread of severities.
- behaviorChanges: what callers or users will experience differently after this merges, anchored the same way. Empty list if behavior is unchanged.
- The list sizes must come from the diff, not from a sense of a tidy answer. A small clean PR may have zero risks; a large one may justify a dozen or more risks and behavior changes. List every one you actually see — never pad toward a count, never trim to keep a section short.
- Every risk and behavior change carries a title: a very short label (3–6 words) naming it for a navigation list, alongside the full text.
- outOfScope: related work this PR deliberately does NOT do — things a reviewer might expect but won't find. Short entries.
- Anchors use line numbers in the NEW version of the file, derived from the @@ hunk headers. Use null for a whole-file claim.
- Text fields render as GitHub-flavored markdown. Wrap every code identifier — function, hook, variable, type, prop, file, and branch names — in backticks (\`useUpdateTouchpointBlocks\`, \`src/api/blocks.ts\`) so it renders as code. Tag fenced code blocks with a language (\`\`\`ts, \`\`\`diff, …) so they get syntax highlighting.
- Never claim anything the diff does not show. If a patch is truncated or omitted, say less rather than guessing.`;

// Voice presets appended to the system prompt. They may only change the
// wording of text fields — never what gets reported, the groups, anchors,
// severities, or list sizes.
const PERSONALITY_PROMPTS: Record<ReviewPersonality, string> = {
  standard: "",
  technical: `Write for a staff-level engineer who knows this stack deeply.
- Name the exact functions, types, APIs, and mechanisms involved — "the useEffect cleanup", "the ETag header", not "some cleanup logic". Use precise domain vocabulary (idempotency, race condition, memoization) without defining it.
- State implications, not narration. Never describe what a line obviously does; say what follows from it.
- Quantify where the diff allows: complexity, allocations, payload sizes, round trips.
- No analogies, no hand-holding, no softening. Density over accessibility.`,
  non_technical: `Write for a smart reader who doesn't write code — a product manager or designer.
- Lead every explanation with what the user or the business will notice: what works now that didn't, what could go wrong and what that would look like in the product.
- No jargon at all. Describe code by its job, not its name: "the file that decides how an email looks in Outlook", not "the Image primitive". If a technical term is truly unavoidable, explain it in everyday words the first time.
- Everyday analogies are welcome when they make a mechanism click.
- Short paragraphs. If a detail only matters to programmers, leave it out.`,
  simplified: `Write for a developer in their first week on the job.
- Short sentences. One idea per sentence. Everyday words.
- No engineering jargon. Say what happens, not what it's called: "the saved copy on the server" not "authoritative data", "the screen doesn't update to match" not "state doesn't reconcile", "runs at the same time and they trip over each other" not "race condition". Code identifiers in backticks are fine — abstract vocabulary is the problem, not names.
- Assume they can program but don't know this codebase or its tricks. Briefly define anything specialised the first time it appears ("Outlook uses Word to draw emails — Word ignores a lot of normal HTML").
- Prefer a concrete example over an abstract description. Show the before and after in plain terms.
- No nested clauses, no rhetorical flourishes. If a sentence needs a comma, try splitting it.`,
  ste: `Write in ASD-STE100 Simplified Technical English, the controlled English of aerospace maintenance manuals. It is a strict rule set, not a tone:
- One word, one meaning. Use the same word for the same thing every time. Never use a synonym for variety: if you call it "the cache" once, it stays "the cache".
- Active voice only. Name the actor: "the handler reads the token", never "the token is read".
- Short sentences. Keep an instruction to 20 words or fewer. Keep a statement of fact to 25 words or fewer.
- One idea per sentence. One instruction per sentence.
- Use simple verbs and simple tenses. Do not use a verb as a noun ("the change happens" instead of "the occurrence of the change").
- Use articles: "the file", "a request" — never "file fails to load".
- Do not use more than three nouns together. Break up a noun cluster with "of" or "for": "the state of the review thread", not "review thread state".
- Write in the positive. Say what is true or what to do, not what is not.
- No idioms, no metaphors, no humour, no slang. Nothing figurative at all.
- Keep every technical name exact — file names, function names, and identifiers keep their real spelling and casing, in backticks. Numbers and line references stay exact.
- Plain is the goal, but nothing is dropped: report every risk and every behaviour change in full.`,
  grug: `Write in the voice of the grug-brained developer (grugbrain.dev). Style rules:
- lowercase everywhere. drop articles and helper verbs: "complexity bad", "grug see big function, grug worry". present tense only.
- grug always talks about himself in third person: "grug say", "grug like", "grug recommend". the reader is "you" or "young grug".
- short declarative bursts. repetition for emphasis: "complexity very, very bad".
- complexity is a living enemy: the "complexity demon". danger gets called out plain: "danger here!", "grug reach for club".
- over-clever code comes from "big brain developers". money is "shiney rock". mild approval is "is fine" or "is good, actually". parenthetical asides for grumbles: "(sad but true)".
- grug not know fancy words. no engineering jargon, ever — grug explain the idea in simple everyday words instead: "the real saved copy" not "authoritative data", "screen and server not agree" not "state doesn't reconcile", "two thing run same time, trip over each other" not "race condition". if grug tempted to use consultant word, grug stop and say what actually happen.
- self-deprecating humour is good, but the humour never softens or hides a finding — grug spot every danger and say it plain.
- technical facts stay exact: file names, function names, and line references keep their real spelling and casing (in backticks).`,
  mentor: `Write like a patient senior engineer walking a colleague through the review.
- For every finding: what it is, why it matters, and the general principle or named pattern behind it ("this is the classic time-of-check/time-of-use gap") so the lesson transfers to future reviews.
- When the author did something well that's worth imitating, say so and explain why it works.
- Where useful, add what to look for next time a change like this comes up.
- Encouraging and direct, never condescending. Teach, don't lecture.`,
  concise: `Be as brief as possible while staying grammatical.
- One or two short sentences per point. Active voice.
- No throat-clearing ("it's worth noting", "importantly"), no restating context the reader already has, no describing what the code makes obvious.
- Cut words, never content: every finding is still listed, every anchor still explained.`,
};

function buildSystemPrompt(personality: ReviewPersonality): string {
  const voice = PERSONALITY_PROMPTS[personality];
  if (!voice) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}\n\nVoice — applies only to the wording of text fields (summary, group stories, risk and behavior-change text, outOfScope). It never changes what you report or how the rules above are applied:\n${voice}`;
}

// The schemas follow the strict-mode subset of JSON Schema: every object sets
// additionalProperties: false, lists all properties as required, and nullable
// fields use anyOf instead of a type array.
const anchorSchema = {
  type: "object",
  properties: {
    path: {
      type: "string",
      description: "File path exactly as it appears in the diff",
    },
    line: {
      anyOf: [{ type: "integer" }, { type: "null" }],
      description:
        "Line number in the new version of the file, or null for a whole-file claim",
    },
  },
  required: ["path", "line"],
  additionalProperties: false,
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
  additionalProperties: false,
};

const riskSchema = {
  type: "object",
  properties: {
    ...claimSchema.properties,
    severity: {
      type: "string",
      enum: ["low", "medium", "high"],
      description: "How serious this risk would be if it turns out to be real",
    },
  },
  required: [...claimSchema.required, "severity"],
  additionalProperties: false,
};

const analysisTool = {
  name: "report_analysis",
  description: "Report the structured review analysis of the pull request.",
  strict: true,
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
          additionalProperties: false,
        },
      },
      risks: { type: "array", items: riskSchema },
      behaviorChanges: { type: "array", items: claimSchema },
      outOfScope: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "groups", "risks", "behaviorChanges", "outOfScope"],
    additionalProperties: false,
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
  severity?: string;
}

interface RawGroup {
  title?: string;
  story?: string;
  risk?: string;
  files?: string[];
}

// The API guarantees the tool input is an object, but not that every nested
// value matches the schema — the model sometimes returns a list field as a
// JSON-encoded string. Treat everything as unknown and normalize.
interface RawAnalysis {
  summary?: unknown;
  groups?: unknown;
  risks?: unknown;
  behaviorChanges?: unknown;
  outOfScope?: unknown;
}

function toList(value: unknown, field: string): unknown[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not JSON either; fall through to the error below.
    }
  }
  throw new Error(
    `The model returned a malformed analysis ("${field}" was not a list). Try again.`,
  );
}

// A risk's stable identity: title + first anchor. Survives a re-analysis
// that reports the same risk, so its dismissal sticks — like finding ids.
export function riskId(risk: AnalysisClaim): string {
  const anchor = risk.anchors[0];
  return contentId(
    `risk|${risk.title}|${anchor?.path ?? ""}|${anchor?.line ?? ""}`,
  );
}

// Backfills ids on risks from analyses cached before ids existed, and joins
// each risk's resolution from the shared store (same one findings use).
// Applied at read time — resolutions are never persisted inside the cache.
function withRiskMeta(
  result: AnalysisResult,
  resolved: Record<string, FindingResolution>,
): AnalysisResult {
  return {
    ...result,
    risks: result.risks.map((risk) => {
      const id = risk.id ?? riskId(risk);
      return { ...risk, id, resolution: resolved[id] };
    }),
  };
}

// Cheap lookup used by the renderer to decide between showing a cached
// analysis and the "Analyse PR" empty state. Never calls the model. When the
// branch has moved since the last analysis, the newest analysis of an older
// commit is returned instead of nothing — the renderer compares its headSha
// against the live PR and labels it outdated.
export async function getExistingAnalysis(
  repo: string,
  prNumber: number,
): Promise<AnalysisResult | null> {
  const detail = await getPullRequest(repo, prNumber);
  const result =
    (await getCachedAnalysis(repo, prNumber, detail.headSha)) ??
    (await getLatestAnalysis(repo, prNumber));
  if (!result) return null;
  return withRiskMeta(result, await getResolutions(repo, prNumber));
}

export async function analyzePullRequest(
  repo: string,
  prNumber: number,
  // Matches defaultPersonality in the renderer. Only reached by a caller that
  // sends no personality at all; every UI path states one.
  personality: ReviewPersonality = "ste",
  force = false,
): Promise<AnalysisResult> {
  const detail = await getPullRequest(repo, prNumber);
  if (!force) {
    const cached = await getCachedAnalysis(repo, prNumber, detail.headSha);
    if (cached) {
      return withRiskMeta(cached, await getResolutions(repo, prNumber));
    }
  }

  const files = await listPullRequestFiles(repo, prNumber);
  const context = buildPullRequestContext(detail, files);
  const provider = await getEffectiveLlmProvider();
  const model = await getLlmModel("analysis");
  const { raw, usage } =
    provider === "claude-code"
      ? await requestAnalysisViaClaudeCode(model, context, personality)
      : await requestAnalysisViaApi(model, context, personality);
  const result = toAnalysisResult(raw, detail, files, model, usage);
  await setCachedAnalysis(result);
  return withRiskMeta(result, await getResolutions(repo, prNumber));
}

async function requestAnalysisViaApi(
  model: string,
  prompt: string,
  personality: ReviewPersonality,
): Promise<{ raw: RawAnalysis; usage: AnalysisUsage | undefined }> {
  const apiKey = await getSecret("anthropic");
  if (!apiKey) {
    throw new Error(
      "Connect a Claude API key in settings to analyse pull requests, or switch Claude access to Claude Code.",
    );
  }
  return requestAnalysis(apiKey, model, prompt, personality);
}

// Same analysis through the local Claude Code login — the SDK enforces the
// JSON schema itself. No costUsd: usage comes out of the user's plan.
async function requestAnalysisViaClaudeCode(
  model: string,
  prompt: string,
  personality: ReviewPersonality,
): Promise<{ raw: RawAnalysis; usage: AnalysisUsage }> {
  const { output, usage } = await runStructuredQuery({
    model,
    systemPrompt: buildSystemPrompt(personality),
    prompt,
    schema: analysisTool.input_schema,
  });
  return {
    raw: output as RawAnalysis,
    usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
  };
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
  model: string,
  prompt: string,
  personality: ReviewPersonality,
): Promise<{ raw: RawAnalysis; usage: AnalysisUsage | undefined }> {
  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "structured-outputs-2025-11-13",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: buildSystemPrompt(personality),
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
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  if (message.stop_reason === "max_tokens") {
    throw new Error(
      "The analysis was cut off by the output limit. Try again — if it keeps happening, this PR may be too large to analyse in one pass.",
    );
  }
  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse?.input) {
    throw new Error("The model returned no analysis. Try again.");
  }

  const inputTokens = message.usage?.input_tokens ?? 0;
  const outputTokens = message.usage?.output_tokens ?? 0;
  const pricing = PRICING[model];
  const usage: AnalysisUsage | undefined = message.usage
    ? {
        inputTokens,
        outputTokens,
        costUsd: pricing
          ? (inputTokens * pricing.input + outputTokens * pricing.output) /
            1_000_000
          : undefined,
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
  value: unknown,
  field: string,
  validPaths: Set<string>,
): AnalysisClaim[] {
  return (toList(value, field) as RawClaim[])
    .filter((claim) => claim.text?.trim())
    .map((claim) => ({
      title: claim.title?.trim() || fallbackTitle(claim.text as string),
      text: (claim.text as string).trim(),
      anchors: normalizeAnchors(claim.anchors, validPaths),
    }));
}

const severityLevels: readonly string[] = ["low", "medium", "high"];

function toSeverity(value: string | undefined): RiskSeverity {
  return severityLevels.includes(value ?? "")
    ? (value as RiskSeverity)
    : "medium";
}

function normalizeRisks(value: unknown, validPaths: Set<string>): RiskClaim[] {
  return (toList(value, "risks") as RawClaim[])
    .filter((claim) => claim.text?.trim())
    .map((claim) => {
      const risk: RiskClaim = {
        title: claim.title?.trim() || fallbackTitle(claim.text as string),
        text: (claim.text as string).trim(),
        anchors: normalizeAnchors(claim.anchors, validPaths),
        severity: toSeverity(claim.severity),
      };
      return { ...risk, id: riskId(risk) };
    });
}

// The model occasionally leaks the groups JSON into the end of the summary
// string. Split it off, and if the real groups field came back empty, keep
// the leaked copy so the analysis isn't reduced to an "Everything else" bin.
function splitLeakedGroups(summary: string): {
  prose: string;
  leaked: RawGroup[] | null;
} {
  const start = summary.indexOf('[{"');
  if (start === -1) return { prose: summary, leaked: null };
  try {
    const parsed: unknown = JSON.parse(summary.slice(start).trim());
    if (Array.isArray(parsed)) {
      return {
        prose: summary.slice(0, start).trim(),
        leaked: parsed as RawGroup[],
      };
    }
  } catch {
    // Not valid JSON — treat it as legitimate prose and leave it alone.
  }
  return { prose: summary, leaked: null };
}

function toAnalysisResult(
  raw: RawAnalysis,
  detail: PullRequestDetail,
  files: PullRequestFile[],
  model: string,
  usage: AnalysisUsage | undefined,
): AnalysisResult {
  const validPaths = new Set(files.map((file) => file.path));
  const seenIds = new Set<string>();

  const { prose, leaked } = splitLeakedGroups(
    typeof raw.summary === "string" ? raw.summary.trim() : "",
  );
  const groupList = toList(raw.groups, "groups") as RawGroup[];
  const groupSource = groupList.length > 0 ? groupList : (leaked ?? []);

  const groups: ChangeGroup[] = groupSource
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
    model,
    analyzedAt: new Date().toISOString(),
    usage,
    summary: prose || "The analysis returned no summary.",
    groups,
    risks: normalizeRisks(raw.risks, validPaths),
    behaviorChanges: normalizeClaims(
      raw.behaviorChanges,
      "behaviorChanges",
      validPaths,
    ),
    outOfScope: toList(raw.outOfScope, "outOfScope")
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0),
  };
}
