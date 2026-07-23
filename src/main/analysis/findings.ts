import type { AnalysisUsage, FindingsResult } from "../../shared/types";
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
import {
  FINDING_CATEGORIES,
  normalizeFindings,
  type RawFinding,
} from "./findingsNormalize";
import { buildPullRequestContext } from "./pipeline";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MAX_OUTPUT_TOKENS = 8192;
// Tool-use rounds before the model is forced to report what it has.
const MAX_ITERATIONS = 10;

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

Report every finding through the report_findings tool. If there is nothing worth flagging, call it with an empty list.`;

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
  },
  required: [
    "category",
    "severity",
    "title",
    "body",
    "path",
    "line",
    "suggestion",
  ],
  additionalProperties: false,
};

const findingsSchema = {
  type: "object",
  properties: {
    findings: { type: "array", items: findingItemSchema },
  },
  required: ["findings"],
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
  const context = buildPullRequestContext(detail, files);
  const ctx: ToolContext = { repo, prNumber, headSha: detail.headSha };
  const provider = await getEffectiveLlmProvider();
  const model = await getLlmModel("analysis");

  const { raw, usage } =
    provider === "claude-code"
      ? await runViaClaudeCode(model, context, ctx)
      : await runViaApi(model, context, ctx);

  const result: FindingsResult = {
    repo,
    prNumber,
    headSha: detail.headSha,
    model,
    ranAt: new Date().toISOString(),
    usage,
    findings: normalizeFindings(raw, files),
  };
  return setCachedFindings(result);
}

async function runViaClaudeCode(
  model: string,
  context: string,
  ctx: ToolContext,
): Promise<{ raw: RawFinding[]; usage: AnalysisUsage }> {
  const { findings, usage } = await runFindingsAgentQuery({
    model,
    systemPrompt: SYSTEM_PROMPT,
    prompt: context,
    toolContext: ctx,
    maxTurns: MAX_ITERATIONS,
  });
  return {
    raw: findings as RawFinding[],
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
): Promise<{ raw: RawFinding[]; usage: AnalysisUsage | undefined }> {
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
      const raw = (report.input as { findings?: RawFinding[] }).findings ?? [];
      return { raw, usage: buildUsage(model, inputTokens, outputTokens) };
    }

    const toolUses = message.content.filter(
      (block): block is ContentBlock & ToolUseBlock =>
        block.type === "tool_use",
    );
    if (toolUses.length === 0) {
      // Model answered in text without reporting — nothing to show.
      return { raw: [], usage: buildUsage(model, inputTokens, outputTokens) };
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

  return { raw: [], usage: buildUsage(model, inputTokens, outputTokens) };
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
