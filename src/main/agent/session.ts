import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { BrowserWindow } from "electron";
import { type ChatChunk, chatChunkChannel } from "../../shared/ipc";
import type {
  AnalysisResult,
  ChatMessage,
  ExplainRequest,
  Explanation,
  PullRequestDetail,
  PullRequestFile,
} from "../../shared/types";
import { getCachedAnalysis } from "../analysis/cache";
import { buildPullRequestContext } from "../analysis/pipeline";
import { getPullRequest, listPullRequestFiles } from "../github/client";
import { runChatQuery } from "../llm/claudeCode";
import { getEffectiveLlmProvider, getLlmModel } from "../llm/settings";
import { addExplanation } from "../store/explanations";
import { getSecret } from "../store/secrets";
import { chatTools, runTool, type ToolContext } from "./tools";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MAX_OUTPUT_TOKENS = 4096;
// Messages sent to the model as context; older ones stay stored and visible.
const MAX_HISTORY = 20;
// Messages kept on disk per PR.
const MAX_STORED = 100;
// Tool-use rounds per question before the model is forced to answer.
const MAX_ITERATIONS = 8;

const configDir = join(homedir(), ".pr-reviewer");
const chatsPath = join(configDir, "chats.json");

const SYSTEM_PROMPT = `You are a code-review assistant inside a PR review app. The reviewer is reading a pull request and asks you questions about it.

You can see the PR's metadata and description, the full diff (some patches may be truncated or omitted), and — if present — a prior analysis of the PR (summary, change groups, risks). You also have tools that read the repository at the exact commit under review: read_file, list_files, grep_repo, and git_log. Use them whenever a question needs context beyond the diff — find callers, read surrounding code, check a file's history — instead of guessing. Prefer a few targeted calls over many broad ones. If a tool fails (the workspace can be unavailable), answer from the diff and say what you couldn't verify.

Answer in GitHub-flavored markdown. Be direct and concise — short paragraphs, code references like \`path/to/file.ts:120\`. Never claim code or behavior you haven't seen in the diff or through the tools.`;

interface Session {
  headSha: string;
  context: string;
}

// One context per PR, alive for the app run. Rebuilt if the PR gets new commits.
const sessions = new Map<string, Session>();

// Chat histories are disk-backed so conversations survive restarts.
let histories: Map<string, ChatMessage[]> | null = null;

function chatKey(repo: string, prNumber: number): string {
  return `${repo}#${prNumber}`;
}

async function loadHistories(): Promise<Map<string, ChatMessage[]>> {
  if (histories) return histories;
  try {
    const raw = JSON.parse(await readFile(chatsPath, "utf8")) as Record<
      string,
      ChatMessage[]
    >;
    histories = new Map(Object.entries(raw));
  } catch {
    histories = new Map();
  }
  return histories;
}

async function saveHistories(store: Map<string, ChatMessage[]>): Promise<void> {
  await mkdir(configDir, { recursive: true });
  await writeFile(
    chatsPath,
    JSON.stringify(Object.fromEntries(store), null, 2),
  );
}

export async function getChatHistory(
  repo: string,
  prNumber: number,
): Promise<ChatMessage[]> {
  const store = await loadHistories();
  return store.get(chatKey(repo, prNumber)) ?? [];
}

export async function clearChat(repo: string, prNumber: number): Promise<void> {
  const store = await loadHistories();
  store.delete(chatKey(repo, prNumber));
  await saveHistories(store);
  // Drop the cached context too, so the next question rebuilds it around the
  // fresh analysis.
  sessions.delete(chatKey(repo, prNumber));
}

function buildContext(
  detail: PullRequestDetail,
  files: PullRequestFile[],
  analysis: AnalysisResult | undefined,
): string {
  const parts = [buildPullRequestContext(detail, files)];
  if (analysis) {
    parts.push(
      "",
      "A prior review analysis of this PR, already shown to the reviewer:",
      JSON.stringify({
        summary: analysis.summary,
        groups: analysis.groups,
        risks: analysis.risks,
        behaviorChanges: analysis.behaviorChanges,
        outOfScope: analysis.outOfScope,
      }),
    );
  }
  return parts.join("\n");
}

async function getSession(repo: string, prNumber: number): Promise<Session> {
  const key = chatKey(repo, prNumber);
  const detail = await getPullRequest(repo, prNumber);
  const existing = sessions.get(key);
  if (existing && existing.headSha === detail.headSha) return existing;

  const files = await listPullRequestFiles(repo, prNumber);
  const analysis = await getCachedAnalysis(repo, prNumber, detail.headSha);
  const session: Session = {
    headSha: detail.headSha,
    context: buildContext(detail, files, analysis),
  };
  sessions.set(key, session);
  return session;
}

function sendChunk(chunk: ChatChunk): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(chatChunkChannel, chunk);
  }
}

interface TextBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
  cache_control?: { type: "ephemeral" };
}

type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

interface ApiMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

interface StreamEvent {
  type: string;
  index?: number;
  content_block?: { type: string; id?: string; name?: string };
  delta?: {
    type: string;
    text?: string;
    partial_json?: string;
    stop_reason?: string | null;
  };
  error?: { message?: string };
}

interface TurnResult {
  text: string;
  toolUses: ToolUseBlock[];
  stopReason: string | null;
}

function parseToolInput(json: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(json || "{}");
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

// One streamed request: text deltas go to onText as they arrive; any tool
// calls the model makes are collected and returned with the stop reason.
async function streamTurn(
  apiKey: string,
  body: Record<string, unknown>,
  onText: (text: string) => void,
): Promise<TurnResult> {
  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    throw new Error(
      "Anthropic rejected your API key. Re-check it in settings.",
    );
  }
  if (!res.ok) {
    let detail = "";
    try {
      const errorBody = (await res.json()) as { error?: { message?: string } };
      detail = errorBody.error?.message ?? "";
    } catch {
      // Non-JSON error body; fall back to the status code.
    }
    throw new Error(
      detail
        ? `Anthropic error: ${detail}`
        : `Anthropic returned status ${res.status}.`,
    );
  }
  if (!res.body) {
    throw new Error("Anthropic returned an empty response stream.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let stopReason: string | null = null;
  const pendingTools = new Map<
    number,
    { id: string; name: string; json: string }
  >();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const event = JSON.parse(line.slice(6)) as StreamEvent;

      if (event.type === "error") {
        throw new Error(event.error?.message ?? "The answer stream failed.");
      }
      if (
        event.type === "content_block_start" &&
        event.content_block?.type === "tool_use" &&
        event.index !== undefined
      ) {
        pendingTools.set(event.index, {
          id: event.content_block.id ?? "",
          name: event.content_block.name ?? "",
          json: "",
        });
      }
      if (event.type === "content_block_delta" && event.delta) {
        if (event.delta.type === "text_delta" && event.delta.text) {
          text += event.delta.text;
          onText(event.delta.text);
        }
        if (
          event.delta.type === "input_json_delta" &&
          event.index !== undefined
        ) {
          const pending = pendingTools.get(event.index);
          if (pending) pending.json += event.delta.partial_json ?? "";
        }
      }
      if (event.type === "message_delta" && event.delta?.stop_reason) {
        stopReason = event.delta.stop_reason;
      }
    }
  }

  const toolUses: ToolUseBlock[] = [...pendingTools.values()].map((tool) => ({
    type: "tool_use",
    id: tool.id,
    name: tool.name,
    input: parseToolInput(tool.json),
  }));
  return { text, toolUses, stopReason };
}

// Keep a single cache breakpoint on the newest tool results, so each loop
// iteration re-reads the growing conversation from Anthropic's prompt cache
// instead of re-paying for all of it.
function moveCacheBreakpoint(messages: ApiMessage[]): void {
  let last: TextBlock | ToolResultBlock | null = null;
  for (const message of messages) {
    if (!Array.isArray(message.content)) continue;
    for (const block of message.content) {
      if (block.type === "tool_use") continue;
      if (block.cache_control) delete block.cache_control;
      last = block;
    }
  }
  if (last) last.cache_control = { type: "ephemeral" };
}

// Runs the agent for one question and returns its full answer. Text deltas go
// to onText as they stream — the chat forwards them to the renderer; a one-shot
// explanation passes a no-op so it stays out of the chat stream.
async function generateAnswer(
  session: Session,
  ctx: ToolContext,
  history: ChatMessage[],
  question: string,
  onText: (text: string) => void,
): Promise<string> {
  const provider = await getEffectiveLlmProvider();
  const model = await getLlmModel("chat");
  return provider === "claude-code"
    ? askViaClaudeCode(model, session, ctx, history, question, onText)
    : askViaApi(model, session, ctx, history, question, onText);
}

export async function askQuestion(
  repo: string,
  prNumber: number,
  question: string,
): Promise<string> {
  const session = await getSession(repo, prNumber);
  const store = await loadHistories();
  const history = store.get(chatKey(repo, prNumber)) ?? [];
  const ctx: ToolContext = { repo, prNumber, headSha: session.headSha };

  const answer = await generateAnswer(session, ctx, history, question, (text) =>
    sendChunk({ repo, prNumber, text }),
  );

  const finalAnswer =
    answer || "I couldn't produce an answer — please try asking again.";
  const updated = [
    ...history,
    { role: "user" as const, content: question },
    { role: "assistant" as const, content: finalAnswer },
  ].slice(-MAX_STORED);
  store.set(chatKey(repo, prNumber), updated);
  await saveHistories(store);

  return finalAnswer;
}

function buildExplainPrompt(request: ExplainRequest): string {
  const range =
    request.startLine !== null
      ? `${request.path}:${request.startLine}-${request.line}`
      : `${request.path}:${request.line}`;
  const version = request.side === "LEFT" ? " (from the old version)" : "";
  return [
    `Explain these selected lines from the diff — ${range}${version}:`,
    "",
    "```",
    request.code,
    "```",
    "",
    "Explain what this code does and why it's here in the context of this pull request. Be concise. If it introduces a risk or changes behavior worth noting, say so briefly. Reference specific lines where it helps.",
  ].join("\n");
}

// Explains a selected diff range with the Q&A agent, one-shot: the answer is
// NOT written to the chat history and doesn't stream into the chat. The result
// is saved to the local explanations store — never posted to GitHub.
export async function explainSelection(
  repo: string,
  prNumber: number,
  request: ExplainRequest,
): Promise<Explanation> {
  const session = await getSession(repo, prNumber);
  const ctx: ToolContext = { repo, prNumber, headSha: session.headSha };
  const answer = await generateAnswer(
    session,
    ctx,
    [],
    buildExplainPrompt(request),
    () => {},
  );
  return addExplanation(repo, prNumber, {
    path: request.path,
    side: request.side,
    line: request.line,
    startLine: request.startLine,
    code: request.code,
    body: answer || "I couldn't produce an explanation — please try again.",
    headSha: session.headSha,
  });
}

// Claude Code queries are single-shot, so earlier turns ride along as text in
// the prompt instead of as separate API messages.
function renderHistory(history: ChatMessage[]): string {
  return history
    .map(
      (message) =>
        `${message.role === "user" ? "Reviewer" : "Assistant"}: ${message.content}`,
    )
    .join("\n\n");
}

async function askViaClaudeCode(
  model: string,
  session: Session,
  ctx: ToolContext,
  history: ChatMessage[],
  question: string,
  onText: (text: string) => void,
): Promise<string> {
  const recent = history.slice(-MAX_HISTORY);
  const prompt =
    recent.length > 0
      ? `Earlier conversation between the reviewer and you:\n\n${renderHistory(recent)}\n\n---\n\nThe reviewer's new question:\n${question}`
      : question;

  return runChatQuery({
    model,
    systemPrompt: `${SYSTEM_PROMPT}\n\n${session.context}`,
    prompt,
    toolContext: ctx,
    maxTurns: MAX_ITERATIONS,
    onText,
  });
}

async function askViaApi(
  model: string,
  session: Session,
  ctx: ToolContext,
  history: ChatMessage[],
  question: string,
  onText: (text: string) => void,
): Promise<string> {
  const apiKey = await getSecret("anthropic");
  if (!apiKey) {
    throw new Error(
      "Connect a Claude API key in settings to use the review chat, or switch Claude access to Claude Code.",
    );
  }

  // Stored history is plain text (tool activity is not replayed across
  // questions); within this question the full tool conversation is kept.
  const messages: ApiMessage[] = [
    ...history
      .slice(-MAX_HISTORY)
      .map((message): ApiMessage => ({ ...message })),
    { role: "user", content: question },
  ];

  const system = [
    { type: "text", text: SYSTEM_PROMPT },
    // The big diff block is identical across questions — cache it so
    // follow-ups don't re-pay for the whole context.
    {
      type: "text",
      text: session.context,
      cache_control: { type: "ephemeral" },
    },
  ];

  let answer = "";
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // Final round goes out without tools so the model must answer in text.
    const useTools = iteration < MAX_ITERATIONS - 1;
    const turn = await streamTurn(
      apiKey,
      {
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        stream: true,
        system,
        tools: useTools ? chatTools : undefined,
        messages,
      },
      onText,
    );

    if (turn.text) answer += (answer ? "\n\n" : "") + turn.text;
    if (turn.stopReason !== "tool_use" || turn.toolUses.length === 0) break;

    const assistantContent: ContentBlock[] = [
      ...(turn.text ? [{ type: "text", text: turn.text } as TextBlock] : []),
      ...turn.toolUses,
    ];
    messages.push({ role: "assistant", content: assistantContent });

    const results: ToolResultBlock[] = [];
    for (const use of turn.toolUses) {
      try {
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: await runTool(ctx, use.name, use.input),
        });
      } catch (cause) {
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content:
            cause instanceof Error ? cause.message : "The tool call failed.",
          is_error: true,
        });
      }
    }
    messages.push({ role: "user", content: results });
    moveCacheBreakpoint(messages);

    // Visual break in the streamed bubble between pre-tool and post-tool text.
    if (turn.text) onText("\n\n");
  }

  return answer;
}
