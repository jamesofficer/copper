import { BrowserWindow } from "electron";
import { type ChatChunk, chatChunkChannel } from "../../shared/ipc";
import type {
  AnalysisResult,
  ChatMessage,
  PullRequestDetail,
  PullRequestFile,
} from "../../shared/types";
import { getCachedAnalysis } from "../analysis/cache";
import { buildPullRequestContext } from "../analysis/pipeline";
import { getPullRequest, listPullRequestFiles } from "../github/client";
import { getSecret } from "../store/secrets";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const CHAT_MODEL = "claude-sonnet-5";
const MAX_OUTPUT_TOKENS = 4096;
const MAX_HISTORY = 20;

const SYSTEM_PROMPT = `You are a code-review assistant inside a PR review app. The reviewer is reading a pull request and asks you questions about it.

You can see: the PR's metadata and description, the full diff (some patches may be truncated or omitted), and — if present — a prior analysis of the PR (summary, change groups, risks). You cannot see the rest of the repository, run code, or browse. If a question needs context beyond the diff (e.g. "who else calls this function?"), say so plainly instead of guessing.

Answer in GitHub-flavored markdown. Be direct and concise — short paragraphs, code references like \`path/to/file.ts:120\` when pointing at the diff. Never invent code or behavior the diff does not show.`;

interface Session {
  headSha: string;
  context: string;
  history: ChatMessage[];
}

// One session per PR, alive for the app run. Rebuilt if the PR gets new
// commits; TODO: repo-context tools (read_file, grep_repo, git_log) later.
const sessions = new Map<string, Session>();

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
  const key = `${repo}#${prNumber}`;
  const detail = await getPullRequest(repo, prNumber);
  const existing = sessions.get(key);
  if (existing && existing.headSha === detail.headSha) return existing;

  const files = await listPullRequestFiles(repo, prNumber);
  const analysis = await getCachedAnalysis(repo, prNumber, detail.headSha);
  const session: Session = {
    headSha: detail.headSha,
    context: buildContext(detail, files, analysis),
    // New commits change the context but the conversation continues.
    history: existing?.history ?? [],
  };
  sessions.set(key, session);
  return session;
}

function sendChunk(chunk: ChatChunk): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(chatChunkChannel, chunk);
  }
}

interface StreamEvent {
  type: string;
  delta?: { type: string; text?: string };
  error?: { message?: string };
}

async function streamAnswer(
  apiKey: string,
  session: Session,
  question: string,
  onText: (text: string) => void,
): Promise<string> {
  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: true,
      system: [
        { type: "text", text: SYSTEM_PROMPT },
        // The big diff block is identical across questions — cache it so
        // follow-ups don't re-pay for the whole context.
        {
          type: "text",
          text: session.context,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [...session.history, { role: "user", content: question }],
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
  if (!res.body) {
    throw new Error("Anthropic returned an empty response stream.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";

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
        event.type === "content_block_delta" &&
        event.delta?.type === "text_delta" &&
        event.delta.text
      ) {
        answer += event.delta.text;
        onText(event.delta.text);
      }
    }
  }

  return answer;
}

export async function askQuestion(
  repo: string,
  prNumber: number,
  question: string,
): Promise<string> {
  const apiKey = await getSecret("anthropic");
  if (!apiKey) {
    throw new Error(
      "Connect a Claude API key in settings to use the review chat.",
    );
  }

  const session = await getSession(repo, prNumber);
  const answer = await streamAnswer(apiKey, session, question, (text) =>
    sendChunk({ repo, prNumber, text }),
  );

  session.history.push(
    { role: "user", content: question },
    { role: "assistant", content: answer },
  );
  if (session.history.length > MAX_HISTORY) {
    session.history.splice(0, session.history.length - MAX_HISTORY);
  }

  return answer;
}
