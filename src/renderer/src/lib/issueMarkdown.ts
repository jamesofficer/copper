import type { PullRequestFile } from "../../../shared/types";
import {
  categoryMeta,
  issueVerdict,
  type ReviewIssue,
  verdictMeta,
} from "./issues";
import { patchSnippet } from "./patchSnippet";

// Which commit each kind of anchor was measured against, and where the PR is
// now. Built once by the review screen and handed to every copy path, so the
// single-issue and copy-all buttons can't disagree about staleness.
export interface IssueAnchorCommits {
  // Risks come from the analysis, findings from the findings run — the two can
  // be different commits, so an issue's kind decides which one applies.
  analysisSha: string;
  findingsSha?: string | null;
  // The PR's head now. Undefined while the detail query is in flight, which
  // reads as "no reason to doubt the anchors".
  currentSha?: string | null;
}

export interface IssueMarkdownSource extends IssueAnchorCommits {
  repo: string;
  prNumber: number;
  // The PR's changed files, for quoting the code each anchor points at. Empty
  // while the diffs are still loading, which just omits the code.
  fileByPath: Map<string, PullRequestFile>;
}

type Source = IssueMarkdownSource;

// The commit the issue's own anchors were computed against.
function anchorCommit(issue: ReviewIssue, source: IssueAnchorCommits): string {
  if (issue.kind === "finding") {
    return source.findingsSha ?? source.analysisSha;
  }
  return source.analysisSha;
}

// Anchors are line numbers in the diff of one commit. Once the PR moves past
// it, an edit anywhere earlier in a file renumbers everything below, so the
// line may now point at unrelated code. Exported so a button can say in advance
// that its copy will carry no code, rather than the two disagreeing.
export function anchorsMayHaveMoved(
  issue: ReviewIssue,
  source: IssueAnchorCommits,
): boolean {
  const measured = anchorCommit(issue, source);
  return Boolean(
    source.currentSha && measured && source.currentSha !== measured,
  );
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
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
  // Cut from the *current* diff at a line measured against an older one, so the
  // window can hold code that has nothing to do with the issue. Quoting it
  // would present the wrong evidence as evidence — worse than quoting none.
  if (anchorsMayHaveMoved(issue, source)) return [];

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

  // Which commit the lines above were numbered against. Cheap to carry, and
  // without it a paste can't be checked against anything.
  const measured = anchorCommit(issue, source);
  if (measured) {
    lines.push(`Reported against commit \`${shortSha(measured)}\`.`);
  }

  lines.push(
    "",
    issue.kind === "finding" ? issue.finding.body : issue.risk.text,
  );

  // Said in the document rather than left to the reader: whoever receives this
  // has no way to know the review is behind the branch.
  if (anchorsMayHaveMoved(issue, source) && source.currentSha) {
    lines.push(
      "",
      `> The pull request has moved on to \`${shortSha(source.currentSha)}\` since this was reported, so the line numbers above may have shifted and the code isn't quoted. Re-run the review to refresh it.`,
    );
  }

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

// Every issue in one document, for handing a whole review to an agent instead
// of copying each one in turn. Each issue keeps the same self-contained form it
// has on its own — repeated PR reference included — because a long paste often
// gets split up again at the other end.
export function issuesToMarkdown(
  issues: ReviewIssue[],
  source: Source,
): string {
  const count = issues.length;
  const heading = `# ${count} issue${count === 1 ? "" : "s"} on ${source.repo}#${source.prNumber}`;
  // A rule between issues — but not under the heading, which the first issue's
  // own heading already follows. It's there so where one issue ends and the
  // next begins survives a paste into something that doesn't render headings.
  const body = issues
    .map((issue) => issueToMarkdown(issue, source).trim())
    .join("\n\n---\n\n");
  return `${heading}\n\n${body}\n`;
}
