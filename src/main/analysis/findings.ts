import type {
  AnalysisUsage,
  FindingsResult,
  LeadVerdict,
  ReviewFinding,
  RiskClaim,
} from "../../shared/types";
import { chatTools, runTool, type ToolContext } from "../agent/tools";
import { getPullRequest, listPullRequestFiles } from "../github/client";
import { runFindingsAgentQuery } from "../llm/claudeCode";
import { getEffectiveLlmProvider, getLlmModel } from "../llm/settings";
import {
  getCachedFindings,
  getLatestFindings,
  setCachedFindings,
} from "../store/findings";
import { getSecret } from "../store/secrets";
import { getCachedAnalysis } from "./cache";
import {
  FINDING_CATEGORIES,
  normalizeFindings,
  type RawFinding,
} from "./findingsNormalize";
import { buildPullRequestContext, riskId } from "./pipeline";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MAX_OUTPUT_TOKENS = 8192;
// API path: tool-use rounds before the model is forced to report what it
// has (each round can hold several tool calls).
const MAX_ITERATIONS = 10;
// Claude Code path: SDK turns are counted per assistant message, so the
// same investigation needs a much larger number — and unlike the API loop,
// the SDK can't force report_findings at the end, so running out of turns
// loses the whole run. Sized for a big PR plus a list of leads to verify.
const MAX_AGENT_TURNS = 30;

const PRICING: Record<string, { input: number; output: number }> = {
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

const SYSTEM_PROMPT = `You are a senior engineer doing a pre-review pass over a pull request. Your job is to surface CANDIDATE issues for a human reviewer to verify — not to approve, not to rewrite. The reviewer decides; you point.

You can see the PR's metadata, description, and diff. You also have tools that read the whole repository at the commit under review: read_file, list_files, grep_repo, git_log. USE THEM — the most valuable findings come from outside the diff:
- Blast radius: when a function, type, or signature changes, grep for its callers and check whether each was updated. Callers the diff didn't touch are where bugs hide. Report the ones that look broken.
- Read the surrounding code a changed line sits in before judging it — the diff alone often misleads.

What to report:
- Real problems only: bugs, unhandled edge cases, security holes, race conditions, performance cliffs, missing test coverage for risky logic, and blast-radius misses. Something a reviewer would genuinely want flagged.
- Be precise and specific. Every finding names the concrete failure: the input, state, or sequence that triggers it and what goes wrong.
- Quality over quantity. A clean PR may have zero findings — say nothing rather than pad. Never invent concerns to fill a list. No style nits, no formatting, no "consider renaming" unless it causes an actual bug.
- Each finding anchors to ONE line that appears in this PR's diff, using the NEW-file line number from the @@ hunk headers. For a blast-radius miss, anchor to the changed definition in the diff (not the external caller, which isn't in the diff) and name the external callers in the text.

For each finding provide:
- category: one of bug, blast_radius, edge_case, security, performance, maintainability, test_gap.
- severity: high (could break production, lose data, or open a security hole), medium (a real bug or regression is plausible), low (minor or unlikely to bite).
- title: 3–7 words naming the issue.
- body: the explanation in GitHub-flavored markdown — what's wrong, when it bites, and how you verified it (which files/callers you checked). Wrap code identifiers and paths in backticks.
- path + line: the anchor, in the diff, new-file numbering.
- suggestion: the review comment text as you'd post it to the author — direct, specific, actionable. Markdown.

Report every finding through the report_findings tool. If there is nothing worth flagging, call it with an empty list.

Work within a limited tool budget: batch related tool calls, don't re-read files you've already seen, and stop investigating a thread once you know enough to judge it. ALWAYS end by calling report_findings — reporting what you have is better than running out of turns with nothing reported.

The prompt may end with a numbered list of LEADS — unverified concerns from an earlier diff-only pass. Handle every lead you can:
- Investigate it with the tools before judging — read the surrounding code, check the callers. If it's a real problem, report it as a normal finding with its "lead" field set to the lead's number, and say in the body what you checked.
- If you investigated it and it's fine, put it in clearedLeads with a one-line note saying how you know.
- If you couldn't check it, leave it out of both — never confirm or clear a lead you didn't investigate.
Findings unrelated to any lead use lead: null.`;

interface RawClearedLead {
  lead?: number;
  note?: string;
}

const findingItemSchema = {
  type: "object",
  properties: {
    category: { type: "string", enum: FINDING_CATEGORIES },
    severity: { type: "string", enum: ["low", "medium", "high"] },
    title: { type: "string", description: "3–7 word label for the issue" },
    body: {
      type: "string",
      description: "Explanation in GitHub-flavored markdown",
    },
    path: {
      type: "string",
      description: "File path exactly as it appears in the diff",
    },
    line: {
      type: "integer",
      description: "Line number in the new version of the file, from the diff",
    },
    suggestion: {
      type: "string",
      description: "Ready-to-post review comment text for the author",
    },
    lead: {
      anyOf: [{ type: "integer" }, { type: "null" }],
      description:
        "The 1-based number of the lead this finding confirms, or null when it isn't tied to a lead",
    },
  },
  required: [
    "category",
    "severity",
    "title",
    "body",
    "path",
    "line",
    "suggestion",
    "lead",
  ],
  additionalProperties: false,
};

const findingsSchema = {
  type: "object",
  properties: {
    findings: { type: "array", items: findingItemSchema },
    clearedLeads: {
      type: "array",
      description:
        "Leads you investigated and found to be fine — not real problems",
      items: {
        type: "object",
        properties: {
          lead: { type: "integer", description: "1-based lead number" },
          note: {
            type: "string",
            description: "One line: how you verified it's fine",
          },
        },
        required: ["lead", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["findings", "clearedLeads"],
  additionalProperties: false,
};

const findingsTool = {
  name: "report_findings",
  description:
    "Report the candidate issues found in the pull request for the reviewer to verify.",
  strict: true,
  input_schema: findingsSchema,
};

// Cheap cache-only lookup — never calls the model. Returns the current
// commit's run, or the newest older run so the UI can show it flagged as
// outdated, mirroring getExistingAnalysis.
export async function getExistingFindings(
  repo: string,
  prNumber: number,
): Promise<FindingsResult | null> {
  const detail = await getPullRequest(repo, prNumber);
  const current = await getCachedFindings(repo, prNumber, detail.headSha);
  return current ?? (await getLatestFindings(repo, prNumber)) ?? null;
}

// The analysis's risks, rendered as numbered leads for the model to verify.
function buildLeadsSection(leads: RiskClaim[]): string {
  const lines = [
    "LEADS — unverified concerns from an earlier diff-only pass. Investigate each with the repo tools; confirm it as a finding (with its lead number) or clear it:",
  ];
  leads.forEach((risk, index) => {
    const anchors = risk.anchors
      .map((a) => (a.line === null ? a.path : `${a.path}:${a.line}`))
      .join(", ");
    lines.push(
      `${index + 1}. [${risk.severity ?? "medium"}] ${risk.title}`,
      `   ${risk.text.replace(/\n/g, "\n   ")}`,
    );
    if (anchors) lines.push(`   Lines: ${anchors}`);
  });
  return lines.join("\n");
}

// Turns the model's lead references into verdicts keyed by risk id, so the
// renderer can join them back onto the analysis's risks. A confirming
// finding outranks a clear of the same lead.
function buildLeadVerdicts(
  leadIds: string[],
  findings: ReviewFinding[],
  cleared: RawClearedLead[],
): LeadVerdict[] {
  const verdicts = new Map<string, LeadVerdict>();
  for (const finding of findings) {
    if (typeof finding.lead !== "number") continue;
    const id = leadIds[finding.lead - 1];
    if (!id || verdicts.has(id)) continue;
    verdicts.set(id, {
      riskId: id,
      status: "confirmed",
      findingId: finding.id,
    });
  }
  for (const entry of cleared) {
    if (typeof entry.lead !== "number") continue;
    const id = leadIds[entry.lead - 1];
    if (!id || verdicts.has(id)) continue;
    verdicts.set(id, {
      riskId: id,
      status: "cleared",
      note: entry.note?.trim() || undefined,
    });
  }
  return [...verdicts.values()];
}

export async function findIssues(
  repo: string,
  prNumber: number,
  force = false,
): Promise<FindingsResult> {
  const detail = await getPullRequest(repo, prNumber);
  if (!force) {
    const cached = await getCachedFindings(repo, prNumber, detail.headSha);
    if (cached) return cached;
  }

  const files = await listPullRequestFiles(repo, prNumber);
  // The same-commit analysis feeds its risks in as leads to verify. No
  // analysis (or an older-commit one) just means a lead-less run.
  const analysis = await getCachedAnalysis(repo, prNumber, detail.headSha);
  const leads = analysis?.risks ?? [];
  const leadIds = leads.map((risk) => risk.id ?? riskId(risk));

  let context = buildPullRequestContext(detail, files);
  if (leads.length > 0) context += `\n\n${buildLeadsSection(leads)}`;

  const ctx: ToolContext = { repo, prNumber, headSha: detail.headSha };
  const provider = await getEffectiveLlmProvider();
  const model = await getLlmModel("analysis");

  const { raw, cleared, usage } =
    provider === "claude-code"
      ? await runViaClaudeCode(model, context, ctx)
      : await runViaApi(model, context, ctx);

  const findings = normalizeFindings(raw, files);
  const result: FindingsResult = {
    repo,
    prNumber,
    headSha: detail.headSha,
    model,
    ranAt: new Date().toISOString(),
    usage,
    findings,
    leadVerdicts: buildLeadVerdicts(leadIds, findings, cleared),
  };
  return setCachedFindings(result);
}

async function runViaClaudeCode(
  model: string,
  context: string,
  ctx: ToolContext,
): Promise<{
  raw: RawFinding[];
  cleared: RawClearedLead[];
  usage: AnalysisUsage;
}> {
  const { findings, clearedLeads, usage } = await runFindingsAgentQuery({
    model,
    systemPrompt: SYSTEM_PROMPT,
    prompt: context,
    toolContext: ctx,
    maxTurns: MAX_AGENT_TURNS,
  });
  return {
    raw: findings as RawFinding[],
    cleared: clearedLeads as RawClearedLead[],
    usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
  };
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ContentBlock {
  type: string;
  id?: string;
  name?: string;
  input?: unknown;
  text?: string;
}

// The API path: an agentic tool loop that ends when the model calls
// report_findings. The repo tools (read_file/grep_repo/…) let it check blast
// radius; the final round forces the report so it always commits.
async function runViaApi(
  model: string,
  context: string,
  ctx: ToolContext,
): Promise<{
  raw: RawFinding[];
  cleared: RawClearedLead[];
  usage: AnalysisUsage | undefined;
}> {
  const apiKey = await getSecret("anthropic");
  if (!apiKey) {
    throw new Error(
      "Connect a Claude API key in settings to find issues, or switch Claude access to Claude Code.",
    );
  }

  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
    { role: "user", content: context },
  ];
  let inputTokens = 0;
  let outputTokens = 0;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const lastRound = iteration === MAX_ITERATIONS - 1;
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        messages,
        tools: [...chatTools, findingsTool],
        // Force the report on the last round so a runaway loop still yields.
        tool_choice: lastRound
          ? { type: "tool", name: "report_findings" }
          : { type: "auto" },
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
      content: ContentBlock[];
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    inputTokens += message.usage?.input_tokens ?? 0;
    outputTokens += message.usage?.output_tokens ?? 0;

    const report = message.content.find(
      (block) => block.type === "tool_use" && block.name === "report_findings",
    );
    if (report?.input) {
      const input = report.input as {
        findings?: RawFinding[];
        clearedLeads?: RawClearedLead[];
      };
      return {
        raw: input.findings ?? [],
        cleared: input.clearedLeads ?? [],
        usage: buildUsage(model, inputTokens, outputTokens),
      };
    }

    const toolUses = message.content.filter(
      (block): block is ContentBlock & ToolUseBlock =>
        block.type === "tool_use",
    );
    if (toolUses.length === 0) {
      // Model answered in text without reporting — nothing to show.
      return {
        raw: [],
        cleared: [],
        usage: buildUsage(model, inputTokens, outputTokens),
      };
    }

    messages.push({ role: "assistant", content: message.content });
    const results = [];
    for (const use of toolUses) {
      try {
        results.push({
          type: "tool_result" as const,
          tool_use_id: use.id,
          content: await runTool(ctx, use.name ?? "", use.input ?? {}),
        });
      } catch (cause) {
        results.push({
          type: "tool_result" as const,
          tool_use_id: use.id,
          content:
            cause instanceof Error ? cause.message : "The tool call failed.",
          is_error: true,
        });
      }
    }
    messages.push({ role: "user", content: results });
  }

  return {
    raw: [],
    cleared: [],
    usage: buildUsage(model, inputTokens, outputTokens),
  };
}

function buildUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
): AnalysisUsage | undefined {
  if (inputTokens === 0 && outputTokens === 0) return undefined;
  const pricing = PRICING[model];
  return {
    inputTokens,
    outputTokens,
    costUsd: pricing
      ? (inputTokens * pricing.input + outputTokens * pricing.output) /
        1_000_000
      : undefined,
  };
}
