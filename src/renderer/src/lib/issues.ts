import type {
  AnalysisResult,
  FindingCategory,
  FindingsResult,
  ReviewFinding,
  RiskClaim,
  RiskSeverity,
} from "../../../shared/types";

// The words the app uses for the model's enums — one table each, so a category
// or verdict reads the same in a badge, in copied markdown, and anywhere else.
export const categoryMeta: Record<
  FindingCategory,
  { label: string; palette: string }
> = {
  bug: { label: "Bug", palette: "red" },
  blast_radius: { label: "Blast radius", palette: "purple" },
  edge_case: { label: "Edge case", palette: "orange" },
  security: { label: "Security", palette: "red" },
  performance: { label: "Performance", palette: "yellow" },
  maintainability: { label: "Maintainability", palette: "gray" },
  test_gap: { label: "Test gap", palette: "blue" },
};

// One entry in the unified Issues list. "finding" = verified by the agent
// pass (tools, evidence, a ready-to-post suggestion). "risk" = an unverified
// concern from the diff-only analysis, waiting to be confirmed or cleared.
export type ReviewIssue =
  | {
      kind: "finding";
      id: string;
      severity: RiskSeverity;
      title: string;
      finding: ReviewFinding;
    }
  | {
      kind: "risk";
      id: string;
      severity: RiskSeverity;
      title: string;
      risk: RiskClaim;
      status: "unchecked" | "checking" | "cleared";
      note?: string;
    };

export interface IssueSets {
  open: ReviewIssue[];
  resolved: ReviewIssue[];
}

// The verification verdict on an issue, derived from the findings pass:
// a finding IS the verified form; a risk is a non-issue once the agent
// cleared it, otherwise checking/unverified. Appearance (badge label,
// colour) is keyed off this — see verdictMeta in IssuePane.
export type IssueVerdict = "verified" | "non_issue" | "checking" | "unverified";

export const verdictMeta: Record<
  IssueVerdict,
  { label: string; palette: string; solid: boolean }
> = {
  verified: { label: "Verified", palette: "green", solid: true },
  non_issue: { label: "Non-issue", palette: "green", solid: true },
  checking: { label: "Checking", palette: "gray", solid: false },
  unverified: { label: "Unverified", palette: "gray", solid: false },
};

export function issueVerdict(issue: ReviewIssue): IssueVerdict {
  if (issue.kind === "finding") return "verified";
  if (issue.status === "cleared") return "non_issue";
  if (issue.status === "checking") return "checking";
  return "unverified";
}

const severityRank: Record<RiskSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function bySeverity(a: ReviewIssue, b: ReviewIssue): number {
  return severityRank[a.severity] - severityRank[b.severity];
}

// Builds the merged list: every finding, plus every risk the findings pass
// didn't confirm (a confirmed risk is represented by its finding). Verified
// findings sort before unverified risks, then by severity high → low.
// `checking` marks pending risks while a findings run is in flight.
export function buildIssues(
  analysis: AnalysisResult,
  findings: FindingsResult | null,
  checking: boolean,
): IssueSets {
  const verdicts = new Map(
    (findings?.leadVerdicts ?? []).map((verdict) => [verdict.riskId, verdict]),
  );

  const findingIssues: ReviewIssue[] = (findings?.findings ?? []).map(
    (finding) => ({
      kind: "finding",
      id: finding.id,
      severity: finding.severity,
      title: finding.title,
      finding,
    }),
  );

  const riskIssues: ReviewIssue[] = [];
  analysis.risks.forEach((risk, index) => {
    // Legacy cached analyses may lack ids until the main process refetch
    // backfills them; the fallback keeps the list rendering meanwhile.
    const id = risk.id ?? `risk-${index}`;
    const verdict = verdicts.get(id);
    if (verdict?.status === "confirmed") return;
    riskIssues.push({
      kind: "risk",
      id,
      severity: risk.severity ?? "medium",
      title: risk.title,
      risk,
      status:
        verdict?.status === "cleared"
          ? "cleared"
          : checking
            ? "checking"
            : "unchecked",
      note: verdict?.note,
    });
  });

  const open: ReviewIssue[] = [];
  const resolved: ReviewIssue[] = [];
  for (const issue of [
    ...findingIssues.sort(bySeverity),
    ...riskIssues.sort(bySeverity),
  ]) {
    const isResolved =
      issue.kind === "finding"
        ? Boolean(issue.finding.resolution)
        : Boolean(issue.risk.resolution) || issue.status === "cleared";
    (isResolved ? resolved : open).push(issue);
  }
  return { open, resolved };
}
