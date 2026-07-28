import {
  createSdkMcpServer,
  type Options,
  query,
  type SDKMessage,
  type SDKResultMessage,
  tool,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { runTool, type ToolContext } from "../agent/tools";

// Runs requests through the user's local Claude Code login, so usage bills to
// their Claude plan instead of API credits. The SDK spawns Claude Code as a
// child process; it reads the same credentials as the `claude` CLI.

const HINT =
  "Check that Claude Code is installed and logged in (run `claude` in a terminal), or switch to an API key in settings.";

export interface ClaudeCodeUsage {
  inputTokens: number;
  outputTokens: number;
}

// The env option REPLACES the child process env, so spread process.env — but
// drop any API key, otherwise the SDK would bill it instead of the plan.
function claudeCodeEnv(): Record<string, string | undefined> {
  return {
    ...process.env,
    ANTHROPIC_API_KEY: undefined,
    ANTHROPIC_AUTH_TOKEN: undefined,
  };
}

function baseOptions(model: string, systemPrompt: string): Options {
  return {
    model,
    systemPrompt,
    env: claudeCodeEnv(),
    // No built-in tools — the app decides exactly what the model can touch.
    tools: [],
    // One-off queries; don't write session files under ~/.claude/projects.
    persistSession: false,
  };
}

function toUsage(result: SDKResultMessage): ClaudeCodeUsage {
  // Present on success and on error result messages (e.g. max-turns), but
  // guard anyway — a missing-usage crash would mask the real outcome.
  const usage = result.usage;
  if (!usage) return { inputTokens: 0, outputTokens: 0 };
  return {
    inputTokens:
      usage.input_tokens +
      usage.cache_read_input_tokens +
      usage.cache_creation_input_tokens,
    outputTokens: usage.output_tokens,
  };
}

function describeFailure(result: SDKResultMessage): string {
  if (result.subtype === "error_max_turns") {
    return "Claude Code hit its tool-use limit before it could report. Run it again — a fresh run usually gets there.";
  }
  const detail =
    result.subtype === "success"
      ? ""
      : result.errors.filter(Boolean).join("; ");
  return detail
    ? `Claude Code error: ${detail}`
    : `Claude Code failed (${result.subtype}). ${HINT}`;
}

// Iterate the SDK stream to its terminal result message. Exceptions here are
// process-level (not installed, not logged in, spawn failure) — wrap them
// with a pointer to the fix.
async function runToResult(
  stream: AsyncIterable<SDKMessage>,
  onMessage?: (message: SDKMessage) => void,
): Promise<SDKResultMessage> {
  try {
    for await (const message of stream) {
      onMessage?.(message);
      if (message.type === "result") return message;
    }
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Claude Code couldn't run: ${reason} ${HINT}`);
  }
  throw new Error(`Claude Code returned no result. ${HINT}`);
}

// One-shot query that must answer with JSON matching the schema. The SDK
// enforces the schema itself (with retries) and returns the parsed object.
export async function runStructuredQuery(params: {
  model: string;
  systemPrompt: string;
  prompt: string;
  schema: Record<string, unknown>;
}): Promise<{ output: unknown; usage: ClaudeCodeUsage }> {
  const stream = query({
    prompt: params.prompt,
    options: {
      ...baseOptions(params.model, params.systemPrompt),
      outputFormat: { type: "json_schema", schema: params.schema },
    },
  });

  const result = await runToResult(stream);
  if (result.subtype !== "success" || result.structured_output === undefined) {
    throw new Error(describeFailure(result));
  }
  return { output: result.structured_output, usage: toUsage(result) };
}

// One report_findings finding, kept loose — normalizeFindings validates it.
const findingShape = {
  category: z.string(),
  severity: z.string(),
  title: z.string(),
  body: z.string(),
  path: z.string(),
  line: z.number(),
  suggestion: z.string(),
  lead: z
    .number()
    .nullable()
    .optional()
    .describe(
      "The 1-based number of the lead this finding confirms, or null when it isn't tied to a lead",
    ),
};

const clearedLeadShape = z.object({
  lead: z.number().describe("1-based lead number"),
  note: z.string().describe("One line: how you verified it's fine"),
});

// The pre-review findings pass on the Claude Code provider. The model
// investigates with the repo tools (callers, history — that's how blast
// radius works), then reports every finding by CALLING a report_findings
// tool. We can't use the SDK's json_schema output format here: combined with
// MCP tools it comes back empty (subtype "success", no structured_output).
// So report_findings is itself an MCP tool whose handler captures the input —
// the same "report via tool call" shape the API path uses.
export async function runFindingsAgentQuery(params: {
  model: string;
  systemPrompt: string;
  prompt: string;
  toolContext: ToolContext;
  maxTurns: number;
}): Promise<{
  findings: unknown[];
  clearedLeads: unknown[];
  usage: ClaudeCodeUsage;
}> {
  let captured: unknown[] = [];
  let capturedCleared: unknown[] = [];
  const reportServer = createSdkMcpServer({
    name: "report",
    version: "1.0.0",
    tools: [
      tool(
        "report_findings",
        "Report the candidate issues found in the pull request for the reviewer to verify. Call this exactly once when your investigation is complete, with every finding (an empty list if there is nothing to flag) and every lead you checked and cleared.",
        {
          findings: z.array(z.object(findingShape)),
          clearedLeads: z
            .array(clearedLeadShape)
            .optional()
            .describe(
              "Leads you investigated and found to be fine — not real problems",
            ),
        },
        async (args) => {
          captured = args.findings ?? [];
          capturedCleared = args.clearedLeads ?? [];
          return {
            content: [{ type: "text" as const, text: "Findings recorded." }],
          };
        },
      ),
    ],
  });

  const stream = query({
    prompt: params.prompt,
    options: {
      ...baseOptions(params.model, params.systemPrompt),
      mcpServers: {
        repo: repoToolServer(params.toolContext),
        report: reportServer,
      },
      allowedTools: [...REPO_TOOL_NAMES, "mcp__report__report_findings"],
      maxTurns: params.maxTurns,
    },
  });

  const result = await runToResult(stream);
  // A finished run with no report_findings call means nothing was flagged.
  if (result.subtype !== "success" && captured.length === 0) {
    throw new Error(describeFailure(result));
  }
  return {
    findings: captured,
    clearedLeads: capturedCleared,
    usage: toUsage(result),
  };
}

// The chat's repo tools, exposed to Claude Code as an in-process MCP server.
// Handlers reuse runTool, so both providers read the repo the exact same way.
function repoToolServer(ctx: ToolContext) {
  async function run(name: string, input: Record<string, unknown>) {
    try {
      return {
        content: [
          { type: "text" as const, text: await runTool(ctx, name, input) },
        ],
      };
    } catch (cause) {
      return {
        content: [
          {
            type: "text" as const,
            text:
              cause instanceof Error ? cause.message : "The tool call failed.",
          },
        ],
        isError: true,
      };
    }
  }

  return createSdkMcpServer({
    name: "repo",
    version: "1.0.0",
    tools: [
      tool(
        "read_file",
        "Read a file from the repository at the commit under review. Returns the file content with line numbers.",
        {
          path: z
            .string()
            .describe("Repository-relative file path, e.g. src/main/index.ts"),
        },
        (args) => run("read_file", args),
      ),
      tool(
        "list_files",
        "List file paths in the repository at the commit under review, optionally only under a directory.",
        {
          directory: z
            .string()
            .optional()
            .describe("Only list files under this directory, e.g. src/lib"),
        },
        (args) => run("list_files", args),
      ),
      tool(
        "grep_repo",
        "Search file contents across the repository at the commit under review. Pattern is a case-sensitive extended regex (POSIX ERE). Returns path:line:content matches.",
        {
          pattern: z.string().describe("Extended regex to search for"),
          directory: z
            .string()
            .optional()
            .describe("Limit the search to this directory"),
        },
        (args) => run("grep_repo", args),
      ),
      tool(
        "git_log",
        "Recent commit history leading up to the commit under review, optionally for a single file path.",
        {
          path: z.string().optional().describe("Repository-relative file path"),
          limit: z
            .number()
            .optional()
            .describe("Maximum commits to return (default 20, max 50)"),
        },
        (args) => run("git_log", args),
      ),
    ],
  });
}

const REPO_TOOL_NAMES = [
  "mcp__repo__read_file",
  "mcp__repo__list_files",
  "mcp__repo__grep_repo",
  "mcp__repo__git_log",
];

interface StreamDelta {
  type: string;
  delta?: { type?: string; text?: string };
}

// Streaming chat query with the repo tools available. Text deltas go to
// onText as they arrive; resolves with the full accumulated answer.
export async function runChatQuery(params: {
  model: string;
  systemPrompt: string;
  prompt: string;
  toolContext: ToolContext;
  maxTurns: number;
  onText(text: string): void;
}): Promise<string> {
  const stream = query({
    prompt: params.prompt,
    options: {
      ...baseOptions(params.model, params.systemPrompt),
      mcpServers: { repo: repoToolServer(params.toolContext) },
      allowedTools: REPO_TOOL_NAMES,
      maxTurns: params.maxTurns,
      includePartialMessages: true,
    },
  });

  let answer = "";
  let needsBreak = false;

  const result = await runToResult(stream, (message) => {
    if (message.type !== "stream_event") return;
    if (message.parent_tool_use_id !== null) return;
    const event = message.event as StreamDelta;

    // A new assistant message after tool use — visual break in the bubble
    // between pre-tool and post-tool text, matching the API path.
    if (event.type === "message_start" && answer) needsBreak = true;

    if (event.type !== "content_block_delta") return;
    const text = event.delta?.type === "text_delta" ? event.delta.text : "";
    if (!text) return;
    if (needsBreak) {
      needsBreak = false;
      answer += "\n\n";
      params.onText("\n\n");
    }
    answer += text;
    params.onText(text);
  });

  if (result.subtype !== "success" && !answer) {
    throw new Error(describeFailure(result));
  }
  return answer || (result.subtype === "success" ? result.result : "");
}
