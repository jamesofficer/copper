import { Box, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import type {
  AnalysisClaim,
  AnalysisResult,
  AnalysisUsage,
  ChangeGroup,
  FindingsResult,
  PullRequest,
  PullRequestFile,
} from "../../../shared/types";
import type { AskContext } from "../lib/askContext";
import type { IssueAnchorCommits } from "../lib/issueMarkdown";
import type { IssueSets } from "../lib/issues";
import type { AnalysisSelection } from "./AnalysisNav";
import {
  AnchorChips,
  AskAboutButton,
  DiffCards,
  type FileMap,
  LoadingDiffs,
  SectionHeading,
} from "./AnalysisShared";
import IssuePane from "./IssuePane";
import Markdown from "./Markdown";
import ResolvedIssuesPane from "./ResolvedIssuesPane";
import RiskBadge from "./RiskBadge";

interface Props {
  pr: PullRequest;
  analysis: AnalysisResult;
  findings: FindingsResult | null;
  issues: IssueSets;
  files: PullRequestFile[] | undefined;
  // Which commit each kind of anchor was measured against, for the copy paths.
  anchorCommits: IssueAnchorCommits;
  currentHeadSha: string | undefined;
  selection: AnalysisSelection;
  onSelect(selection: AnalysisSelection): void;
  onAskAbout(context: AskContext, question?: string): void;
}

function SummaryPane({ analysis }: { analysis: AnalysisResult }) {
  return (
    <VStack alignItems="stretch" gap="6" maxW="3xl">
      <VStack alignItems="stretch" gap="3">
        <SectionHeading>Summary</SectionHeading>
        <Markdown fontSize="md">{analysis.summary}</Markdown>
      </VStack>

      {analysis.outOfScope.length > 0 && (
        <VStack alignItems="stretch" gap="2">
          <SectionHeading>Not in this PR</SectionHeading>
          <VStack alignItems="stretch" gap="1.5">
            {analysis.outOfScope.map((entry) => (
              <Text key={entry} fontSize="md" color="fg.muted">
                – {entry}
              </Text>
            ))}
          </VStack>
        </VStack>
      )}

      <Text fontSize="xs" color="fg.subtle" fontFamily="mono">
        Analysed commit {analysis.headSha.slice(0, 7)} · {analysis.model}
        {analysis.usage ? ` · ${formatCost(analysis.usage)}` : ""}
      </Text>
    </VStack>
  );
}

function formatCost(usage: AnalysisUsage): string {
  const tokens = `${usage.inputTokens.toLocaleString()} in, ${usage.outputTokens.toLocaleString()} out`;
  // No per-token price when the analysis ran on a Claude plan.
  if (usage.costUsd === undefined) return `plan usage (${tokens})`;
  const cost =
    usage.costUsd < 0.01 ? "<$0.01" : `~$${usage.costUsd.toFixed(2)}`;
  return `${cost} (${tokens})`;
}

function ClaimPane({
  claim,
  label,
  files,
  fileByPath,
  onAskAbout,
}: {
  claim: AnalysisClaim;
  label: AskContext["label"];
  files: PullRequestFile[] | undefined;
  fileByPath: FileMap;
  onAskAbout(context: AskContext, question?: string): void;
}) {
  const paths = [...new Set(claim.anchors.map((anchor) => anchor.path))];
  return (
    <VStack alignItems="stretch" gap="4">
      <VStack alignItems="stretch" gap="4" maxW="3xl">
        <HStack gap="3" alignItems="baseline">
          <Heading size="md">{claim.title}</Heading>
        </HStack>
        <Markdown fontSize="md">{claim.text}</Markdown>
        <AnchorChips claim={claim} />
        <Box>
          <AskAboutButton label={label} claim={claim} onAskAbout={onAskAbout} />
        </Box>
      </VStack>
      {paths.length > 0 && (
        <>
          <SectionHeading>Relevant changes</SectionHeading>
          {files ? (
            <DiffCards paths={paths} fileByPath={fileByPath} />
          ) : (
            <LoadingDiffs />
          )}
        </>
      )}
    </VStack>
  );
}

function GroupPane({
  group,
  index,
  files,
  fileByPath,
}: {
  group: ChangeGroup;
  index: number;
  files: PullRequestFile[] | undefined;
  fileByPath: FileMap;
}) {
  return (
    <VStack alignItems="stretch" gap="4">
      <VStack alignItems="stretch" gap="4" maxW="3xl">
        <HStack gap="3" alignItems="baseline">
          <Text
            fontFamily="mono"
            fontSize="sm"
            color="fg.subtle"
            flexShrink="0"
          >
            {index + 1}
          </Text>
          <Heading size="md">{group.title}</Heading>
          <RiskBadge risk={group.risk} />
        </HStack>
        {group.story && <Markdown fontSize="md">{group.story}</Markdown>}
      </VStack>
      {files ? (
        <DiffCards
          paths={group.files}
          fileByPath={fileByPath}
          defaultOpen={group.risk !== "mechanical"}
        />
      ) : (
        <LoadingDiffs />
      )}
    </VStack>
  );
}

export default function AnalysisDetail({
  pr,
  analysis,
  findings,
  issues,
  files,
  anchorCommits,
  currentHeadSha,
  selection,
  onSelect,
  onAskAbout,
}: Props) {
  const fileByPath: FileMap = new Map(
    (files ?? []).map((file) => [file.path, file] as const),
  );

  // Draft anchors come from the findings run; block drafting when it's
  // behind the PR's current commit (the line may have moved).
  const findingsOutdated = Boolean(
    findings && currentHeadSha && findings.headSha !== currentHeadSha,
  );
  const commitId = currentHeadSha ?? findings?.headSha ?? analysis.headSha;

  function resolve(): ReactNode {
    if (selection.kind === "issue") {
      const issue = [...issues.open, ...issues.resolved].find(
        (entry) => entry.id === selection.id,
      );
      if (issue) {
        const issueIndex = issues.open.findIndex(
          (entry) => entry.id === issue.id,
        );
        return (
          <IssuePane
            issue={issue}
            repo={pr.repo}
            prNumber={pr.number}
            commitId={commitId}
            canDraft={!findingsOutdated}
            anchorCommits={anchorCommits}
            files={files}
            fileByPath={fileByPath}
            issuePosition={
              issueIndex === -1
                ? undefined
                : {
                    current: issueIndex + 1,
                    total: issues.open.length,
                    onPrevious: () => {
                      const previous = issues.open[issueIndex - 1];
                      if (previous) {
                        onSelect({ kind: "issue", id: previous.id });
                      }
                    },
                    onNext: () => {
                      const next = issues.open[issueIndex + 1];
                      if (next) onSelect({ kind: "issue", id: next.id });
                    },
                  }
            }
            onAskAbout={onAskAbout}
          />
        );
      }
    }
    if (selection.kind === "resolvedIssues") {
      return (
        <ResolvedIssuesPane
          issues={issues.resolved}
          repo={pr.repo}
          prNumber={pr.number}
          onSelect={(issueId) => onSelect({ kind: "issue", id: issueId })}
        />
      );
    }
    if (selection.kind === "behavior") {
      const claim = analysis.behaviorChanges[selection.index];
      if (claim) {
        return (
          <ClaimPane
            claim={claim}
            label="behavior change"
            files={files}
            fileByPath={fileByPath}
            onAskAbout={onAskAbout}
          />
        );
      }
    }
    if (selection.kind === "group") {
      const group = analysis.groups.find((g) => g.id === selection.id);
      if (group) {
        return (
          <GroupPane
            group={group}
            index={analysis.groups.indexOf(group)}
            files={files}
            fileByPath={fileByPath}
          />
        );
      }
    }
    return <SummaryPane analysis={analysis} />;
  }

  return (
    // Extra bottom padding so scrollable content can overscroll past the end.
    <Box maxW="6xl" mx="auto" px="8" pt="7" pb="80">
      {resolve()}
    </Box>
  );
}
