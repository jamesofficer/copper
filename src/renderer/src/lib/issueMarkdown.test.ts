import { describe, expect, it } from "vitest";
import type {
  PullRequestFile,
  ReviewFinding,
  RiskClaim,
} from "../../../shared/types";
import { issuesToMarkdown, issueToMarkdown } from "./issueMarkdown";
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
  analysisSha: "1111111aaaa",
  findingsSha: "1111111aaaa",
  currentSha: "1111111aaaa",
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

  it("names the commit the lines were numbered against", () => {
    const markdown = issueToMarkdown(findingIssue, source);

    // Without it a paste can't be checked against anything — the line numbers
    // are only meaningful next to the commit they were measured in.
    expect(markdown).toContain("Reported against commit `1111111`.");
  });

  it("quotes no code once the PR has moved past the reported commit", () => {
    const markdown = issueToMarkdown(findingIssue, {
      ...source,
      currentSha: "2222222bbbb",
    });

    // The snippet is cut from the current diff at a line numbered against an
    // older one, so the window can hold unrelated code. Wrong evidence is worse
    // than none, and the mismatch is stated rather than left to the reader.
    expect(markdown).not.toContain("### Relevant changes");
    expect(markdown).not.toContain("```diff");
    expect(markdown).toContain("Reported against commit `1111111`.");
    expect(markdown).toContain("has moved on to `2222222`");
    // The report itself still copies in full.
    expect(markdown).toContain(finding.body);
    expect(markdown).toContain(finding.suggestion);
  });

  it("judges a risk by the analysis commit, not the findings run", () => {
    // A quick review's risks are anchored by the analysis; a later findings run
    // on a newer commit says nothing about whether those risks moved.
    const markdown = issueToMarkdown(riskIssue({}), {
      ...source,
      findingsSha: "2222222bbbb",
      currentSha: "1111111aaaa",
    });

    // Reported against the analysis's commit, and not treated as moved —
    // the newer findings SHA is irrelevant to a risk.
    expect(markdown).toContain("Reported against commit `1111111`.");
    expect(markdown).not.toContain("has moved on to");
  });

  it("keeps quoting while the PR's head is still unknown", () => {
    // The detail query is in flight. That's no reason to doubt the anchors.
    const markdown = issueToMarkdown(findingIssue, {
      ...source,
      currentSha: undefined,
    });

    expect(markdown).toContain("### Relevant changes");
    expect(markdown).not.toContain("has moved on to");
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

describe("issuesToMarkdown", () => {
  it("collects every issue under a counted heading, split by a rule", () => {
    const markdown = issuesToMarkdown([findingIssue, riskIssue({})], source);

    expect(markdown.startsWith("# 2 issues on acme/app#7")).toBe(true);
    expect(markdown).toContain(findingIssue.title);
    expect(markdown).toContain("The retry loop may never exit");
    // One rule between the two issues, and none before the first or after the
    // last — the separator is there to divide, not to decorate.
    expect(markdown.split("\n---\n")).toHaveLength(2);
  });

  it("keeps each issue self-contained", () => {
    const markdown = issuesToMarkdown([findingIssue, riskIssue({})], source);

    // A long paste often gets split up again at the other end, so both halves
    // have to carry their own verdict and location.
    expect(markdown.match(/acme\/app#7/g)).toHaveLength(3);
    expect(markdown).toContain("Verified");
    expect(markdown).toContain("Unverified");
  });

  it("says one issue, not 1 issues", () => {
    const markdown = issuesToMarkdown([findingIssue], source);

    expect(markdown.startsWith("# 1 issue on acme/app#7")).toBe(true);
  });
});
