import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  Spinner,
  Text,
  VStack,
  Wrap,
} from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuRefreshCw } from "react-icons/lu";
import type {
  AnalysisClaim,
  AnalysisResult,
  AnalysisUsage,
  ChangeGroup,
  PullRequestFile,
} from "../../../shared/types";
import type { AnalysisSelection } from "./AnalysisNav";
import FileDiffCard from "./FileDiffCard";
import Markdown from "./Markdown";
import RiskBadge from "./RiskBadge";
import RiskSeverityBadge from "./RiskSeverityBadge";

interface Props {
  analysis: AnalysisResult;
  files: PullRequestFile[] | undefined;
  selection: AnalysisSelection;
  onReanalyze(): void;
  reanalyzing: boolean;
}

type FileMap = Map<string, PullRequestFile>;

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <Heading
      size="xs"
      color="fg.muted"
      textTransform="uppercase"
      letterSpacing="wider"
    >
      {children}
    </Heading>
  );
}

function LoadingDiffs() {
  return (
    <HStack color="fg.muted">
      <Spinner size="sm" />
      <Text fontSize="sm">Loading diffs…</Text>
    </HStack>
  );
}

function fileName(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

function scrollToFile(path: string): void {
  document
    .getElementById(`diff-${path}`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// A claim's anchors as clickable file:line chips that jump to the file's
// embedded diff below.
function AnchorChips({ claim }: { claim: AnalysisClaim }) {
  if (claim.anchors.length === 0) return null;
  return (
    <Wrap gap="1.5">
      {claim.anchors.map((anchor) => (
        <Badge
          key={`${anchor.path}:${anchor.line}`}
          as="button"
          onClick={() => scrollToFile(anchor.path)}
          fontFamily="mono"
          variant="surface"
          cursor="pointer"
          _hover={{ bg: "bg.emphasized" }}
          title={anchor.path}
        >
          {fileName(anchor.path)}
          {anchor.line === null ? "" : `:${anchor.line}`}
        </Badge>
      ))}
    </Wrap>
  );
}

function DiffCards({
  paths,
  fileByPath,
  defaultOpen = true,
}: {
  paths: string[];
  fileByPath: FileMap;
  defaultOpen?: boolean;
}) {
  return (
    <VStack alignItems="stretch" gap="2">
      {paths.map((path) => {
        const file = fileByPath.get(path);
        if (!file) return null;
        return (
          <FileDiffCard
            key={path}
            id={`diff-${path}`}
            file={file}
            defaultOpen={defaultOpen}
          />
        );
      })}
    </VStack>
  );
}

function SummaryPane({
  analysis,
  onReanalyze,
  reanalyzing,
}: {
  analysis: AnalysisResult;
  onReanalyze(): void;
  reanalyzing: boolean;
}) {
  return (
    <VStack alignItems="stretch" gap="6" maxW="3xl">
      <VStack alignItems="stretch" gap="3">
        <SectionHeading>Summary</SectionHeading>
        <Markdown>{analysis.summary}</Markdown>
      </VStack>

      {analysis.outOfScope.length > 0 && (
        <VStack alignItems="stretch" gap="2">
          <SectionHeading>Not in this PR</SectionHeading>
          <VStack alignItems="stretch" gap="1.5">
            {analysis.outOfScope.map((entry) => (
              <Text key={entry} fontSize="sm" color="fg.muted">
                – {entry}
              </Text>
            ))}
          </VStack>
        </VStack>
      )}

      <HStack gap="3">
        <Text fontSize="xs" color="fg.subtle" fontFamily="mono">
          Analysed commit {analysis.headSha.slice(0, 7)} · {analysis.model}
          {analysis.usage ? ` · ${formatCost(analysis.usage)}` : ""}
        </Text>
        <Button
          size="2xs"
          variant="ghost"
          color="fg.muted"
          onClick={onReanalyze}
          loading={reanalyzing}
          loadingText="Re-analysing…"
        >
          <LuRefreshCw /> Re-analyse
        </Button>
      </HStack>
    </VStack>
  );
}

function formatCost(usage: AnalysisUsage): string {
  const cost =
    usage.costUsd < 0.01 ? "<$0.01" : `~$${usage.costUsd.toFixed(2)}`;
  return `${cost} (${usage.inputTokens.toLocaleString()} in, ${usage.outputTokens.toLocaleString()} out)`;
}

function ClaimPane({
  claim,
  badge,
  files,
  fileByPath,
}: {
  claim: AnalysisClaim;
  badge?: ReactNode;
  files: PullRequestFile[] | undefined;
  fileByPath: FileMap;
}) {
  const paths = [...new Set(claim.anchors.map((anchor) => anchor.path))];
  return (
    <VStack alignItems="stretch" gap="4">
      <VStack alignItems="stretch" gap="4" maxW="3xl">
        <HStack gap="3" alignItems="baseline">
          <Heading size="md">{claim.title}</Heading>
          {badge}
        </HStack>
        <Markdown>{claim.text}</Markdown>
        <AnchorChips claim={claim} />
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
        {group.story && <Markdown>{group.story}</Markdown>}
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
  analysis,
  files,
  selection,
  onReanalyze,
  reanalyzing,
}: Props) {
  const fileByPath: FileMap = new Map(
    (files ?? []).map((file) => [file.path, file] as const),
  );

  function resolve(): ReactNode {
    if (selection.kind === "risk") {
      const claim = analysis.risks[selection.index];
      if (claim) {
        return (
          <ClaimPane
            claim={claim}
            badge={<RiskSeverityBadge severity={claim.severity} />}
            files={files}
            fileByPath={fileByPath}
          />
        );
      }
    }
    if (selection.kind === "behavior") {
      const claim = analysis.behaviorChanges[selection.index];
      if (claim) {
        return (
          <ClaimPane claim={claim} files={files} fileByPath={fileByPath} />
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
    return (
      <SummaryPane
        analysis={analysis}
        onReanalyze={onReanalyze}
        reanalyzing={reanalyzing}
      />
    );
  }

  return (
    // Extra bottom padding so scrollable content can overscroll past the end.
    <Box px="8" pt="6" pb="80">
      {resolve()}
    </Box>
  );
}
