import type { PullRequestFile } from "../../../shared/types";
import {
  categoryMeta,
  issueVerdict,
  type ReviewIssue,
  verdictMeta,
} from "./issues";
import { patchSnippet } from "./patchSnippet";

interface Source {
  repo: string;
  prNumber: number;
  // The PR's changed files, for quoting the code each anchor points at. Empty
  // while the diffs are still loading, which just omits the code.
  fileByPath: Map<string, PullRequestFile>;
}

interface Anchor {
  path: string;
  // A risk can name a file without a line; a finding always has one.
  line: number | null;
}

function anchorsOf(issue: ReviewIssue): Anchor[] {
  if (issue.kind === "finding") {
    return [{ path: issue.finding.path, line: issue.finding.line }];
  }
  return issue.risk.anchors.map((anchor) => ({
    path: anchor.path,
    line: anchor.line,
  }));
}

// Matches the anchor chips on screen, which drop the ":line" when there isn't
// one rather than showing "path:null".
function describeAnchor(anchor: Anchor): string {
  return anchor.line === null ? anchor.path : `${anchor.path}:${anchor.line}`;
}

// Each anchor's code as a fenced diff block, labelled with its file and line.
// A diff fence rather than a plain one because the +/− markers are the point:
// they say which lines the PR is adding, which a bare snippet loses.
function codeBlocks(issue: ReviewIssue, source: Source): string[] {
  const lines: string[] = [];

  for (const anchor of anchorsOf(issue)) {
    const patch = source.fileByPath.get(anchor.path)?.patch;
    if (!patch || anchor.line === null) continue;
    const snippet = patchSnippet(patch, anchor.line);
    if (!snippet) continue;
    lines.push(
      "",
      `\`${describeAnchor(anchor)}\``,
      "",
      "```diff",
      snippet,
      "```",
    );
  }

  return lines.length > 0 ? ["", "### Relevant changes", ...lines] : [];
}

// Renders an issue as markdown to hand to another agent. It leads with the
// file and line, because an agent that can't locate the code can't act on the
// report — and the same reason the app never shows a claim without its anchor.
// The anchored diff is quoted for the same reason: pasted into a chat with no
// access to the repo, the claim is unverifiable without it. Verified findings
// carry their suggested comment; an unverified risk says so in the text, so
// nothing reads as more certain than it is.
export function issueToMarkdown(issue: ReviewIssue, source: Source): string {
  const verdict = issueVerdict(issue);
  const parts = [`Severity: ${issue.severity}`];

  if (issue.kind === "finding") {
    parts.push(categoryMeta[issue.finding.category].label);
  }
  parts.push(verdictMeta[verdict].label);
  parts.push(`${source.repo}#${source.prNumber}`);

  const locations = anchorsOf(issue).map(describeAnchor);

  const lines = [`## ${issue.title}`, "", parts.join(" · ")];

  if (locations.length > 0) {
    const label = locations.length === 1 ? "Location" : "Locations";
    lines.push(`${label}: ${locations.map((one) => `\`${one}\``).join(", ")}`);
  }

  lines.push(
    "",
    issue.kind === "finding" ? issue.finding.body : issue.risk.text,
  );

  // The agent's reason for clearing a risk matters as much as the risk itself —
  // pasting the concern without it would send someone chasing a non-issue.
  if (issue.kind === "risk" && issue.status === "cleared" && issue.note) {
    lines.push("", `> Checked and cleared by the review agent: ${issue.note}`);
  }

  // Code before the suggestion: evidence, then the ask.
  lines.push(...codeBlocks(issue, source));

  if (issue.kind === "finding" && issue.finding.suggestion) {
    lines.push("", "### Suggested comment", "", issue.finding.suggestion);
  }

  return `${lines.join("\n")}\n`;
}
