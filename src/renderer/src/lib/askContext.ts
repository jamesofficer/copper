import type { AnalysisClaim, DiffAnchor } from "../../../shared/types";

// A claim attached to the next chat question ("Ask about this" on a risk or
// behavior change). It travels inside the question text itself — serialised
// by buildQuestionWithContext, recognised again by parseQuestion — so the
// main process needs no changes and stored history stays self-describing.
export interface AskContext {
  label: "risk" | "behavior change";
  title: string;
  text: string;
  anchors: DiffAnchor[];
}

// One "Ask about this" click. Without a question it attaches the claim to
// the composer as a chip; with one (a suggested question from the split
// button's menu) it sends immediately. The id makes every click a fresh
// request, so asking about the same claim twice still goes through.
export interface AskRequest {
  id: string;
  context: AskContext;
  question?: string;
}

export const suggestedQuestions: Record<AskContext["label"], string[]> = {
  risk: [
    "Is this a real problem or theoretical?",
    "How likely is this to bite in practice?",
    "How would you fix it?",
  ],
  "behavior change": [
    "Who is affected by this change?",
    "Does the PR description mention this change?",
    "Which callers see the difference?",
  ],
};

export function claimAskContext(
  label: AskContext["label"],
  claim: AnalysisClaim,
): AskContext {
  return {
    label,
    title: claim.title,
    text: claim.text,
    anchors: claim.anchors,
  };
}

function formatAnchor(anchor: DiffAnchor): string {
  return anchor.line === null ? anchor.path : `${anchor.path}:${anchor.line}`;
}

// The claim's full text rides along (not just its title) so the agent can
// answer even if the analysis in its context has since been re-run.
export function buildQuestionWithContext(
  context: AskContext,
  question: string,
): string {
  const lines = [`[About the ${context.label} "${context.title}"]`];
  lines.push(context.text);
  if (context.anchors.length > 0) {
    lines.push(
      `Relevant lines: ${context.anchors.map(formatAnchor).join(", ")}`,
    );
  }
  lines.push("[/About]", "", question);
  return lines.join("\n");
}

export interface ParsedQuestion {
  context: { label: string; title: string } | null;
  question: string;
}

const contextPattern =
  /^\[About the (risk|behavior change) "([\s\S]+?)"\]\n[\s\S]*?\n\[\/About\]\n\n([\s\S]*)$/;

// Splits a stored user message back into its attached-context tag and the
// question the user actually typed, for compact rendering in the chat.
export function parseQuestion(content: string): ParsedQuestion {
  const match = contextPattern.exec(content);
  if (!match) return { context: null, question: content };
  return {
    context: { label: match[1], title: match[2] },
    question: match[3],
  };
}
