import { describe, expect, it } from "vitest";
import type {
  PullRequestFile,
  ReviewFinding,
  RiskClaim,
} from "../../../shared/types";
import { issueToMarkdown } from "./issueMarkdown";
import type { ReviewIssue } from "./issues";

const userPatch = [
  "@@ -40,3 +40,4 @@",
  " export function parseUser(input: string) {",
  "-  return JSON.parse(input);",
  "+  return JSON.parse(input) as User;",
  " }",
].join("\n");

const files: PullRequestFile[] = [
  { path: "src/user.ts", patch: userPatch } as PullRequestFile,
  {
    path: "src/fetch.ts",
    patch: "@@ -8,2 +8,3 @@\n retry();\n+  wait();",
  } as PullRequestFile,
];

const source = {
  repo: "acme/app",
  prNumber: 7,
  fileByPath: new Map(files.map((file) => [file.path, file])),
};

const finding = {
  id: "abc",
  category: "blast_radius",
  severity: "high",
  title: "parseUser's new argument isn't passed by two callers",
  body: "`parseUser` gained a required `locale`, but two call sites still pass one argument.",
  path: "src/user.ts",
  line: 42,
  suggestion: "These callers need updating too.",
} as ReviewFinding;

const findingIssue: ReviewIssue = {
  kind: "finding",
  id: finding.id,
  severity: "high",
  title: finding.title,
  finding,
};

function riskIssue(overrides: Partial<Extract<ReviewIssue, { kind: "risk" }>>) {
  const risk = {
    id: "risk-1",
    title: "The retry loop may never exit",
    text: "Nothing decrements the counter on a network error.",
    severity: "medium",
    anchors: [
      { path: "src/fetch.ts", line: 10 },
      { path: "src/retry.ts", line: 88 },
    ],
  } as RiskClaim;
  return {
    kind: "risk",
    id: risk.id,
    severity: "medium",
    title: risk.title,
    risk,
    status: "unchecked",
    ...overrides,
  } as ReviewIssue;
}

describe("issueToMarkdown", () => {
  it("leads a finding with its category, verdict, and single location", () => {
    const markdown = issueToMarkdown(findingIssue, source);

    expect(markdown).toContain(`## ${finding.title}`);
    expect(markdown).toContain(
      "Severity: high · Blast radius · Verified · acme/app#7",
    );
    // Singular label, and backticked so it survives a paste into a chat that
    // would otherwise linkify or reflow it.
    expect(markdown).toContain("Location: `src/user.ts:42`");
    expect(markdown).toContain(finding.body);
    expect(markdown).toContain("### Suggested comment");
    expect(markdown).toContain(finding.suggestion);
  });

  it("quotes the anchored code as a fenced diff block", () => {
    const markdown = issueToMarkdown(findingIssue, source);

    expect(markdown).toContain("### Relevant changes");
    expect(markdown).toContain("```diff");
    expect(markdown).toContain("+  return JSON.parse(input) as User;");
    // Evidence before the ask: an agent should read the code before the
    // comment it's being asked to act on.
    expect(markdown.indexOf("### Relevant changes")).toBeLessThan(
      markdown.indexOf("### Suggested comment"),
    );
  });

  it("leaves the code out when the diff hasn't loaded", () => {
    const markdown = issueToMarkdown(findingIssue, {
      ...source,
      fileByPath: new Map(),
    });

    // Everything else still copies — a slow files query mustn't cost the user
    // the report itself.
    expect(markdown).toContain(finding.body);
    expect(markdown).not.toContain("### Relevant changes");
  });

  it("lists every anchor of a risk and says it is unverified", () => {
    const markdown = issueToMarkdown(riskIssue({}), source);

    // An unverified risk pasted without that word would read as a confirmed
    // bug to whoever receives it.
    expect(markdown).toContain("Unverified");
    expect(markdown).toContain(
      "Locations: `src/fetch.ts:10`, `src/retry.ts:88`",
    );
    expect(markdown).not.toContain("### Suggested comment");
  });

  it("carries the agent's note when a risk was cleared", () => {
    const markdown = issueToMarkdown(
      riskIssue({ status: "cleared", note: "The caller already guards this." }),
      source,
    );

    expect(markdown).toContain("Non-issue");
    expect(markdown).toContain(
      "> Checked and cleared by the review agent: The caller already guards this.",
    );
  });
});
