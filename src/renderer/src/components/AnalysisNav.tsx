import {
  Box,
  HStack,
  IconButton,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { ReactNode } from "react";
import {
  LuBadgeCheck,
  LuRefreshCw,
  LuScrollText,
  LuTelescope,
} from "react-icons/lu";
import type {
  AnalysisResult,
  ChangeGroupRisk,
  PullRequestFile,
} from "../../../shared/types";
import type { IssueSets } from "../lib/issues";
import CopyIssuesButton from "./CopyIssuesButton";
import { severityDotColor } from "./RiskSeverityBadge";

export type AnalysisSelection =
  | { kind: "summary" }
  | { kind: "issue"; id: string }
  | { kind: "resolvedIssues" }
  | { kind: "behavior"; index: number }
  | { kind: "group"; id: string };

interface Props {
  analysis: AnalysisResult;
  issues: IssueSets;
  repo: string;
  prNumber: number;
  // The PR's diffs, for the copy-all button's quoted code.
  files: PullRequestFile[] | undefined;
  // Whether a findings run exists — decides between "find" and "re-run".
  hasFindings: boolean;
  // A findings run is in flight.
  checking: boolean;
  issuesError: string | null;
  onFindIssues(): void;
  selection: AnalysisSelection;
  onSelect(selection: AnalysisSelection): void;
}

const riskDotColor: Record<ChangeGroupRisk, string> = {
  attention: "orange.solid",
  routine: "blue.solid",
  mechanical: "gray.solid",
};

function sameSelection(a: AnalysisSelection, b: AnalysisSelection): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "summary":
      return true;
    case "resolvedIssues":
      return true;
    case "issue":
      return b.kind === "issue" && a.id === b.id;
    case "group":
      return b.kind === "group" && a.id === b.id;
    case "behavior":
      return b.kind === "behavior" && a.index === b.index;
  }
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text
      fontSize="2xs"
      fontWeight="semibold"
      color="fg.muted"
      textTransform="uppercase"
      letterSpacing="wider"
      px="2"
    >
      {children}
    </Text>
  );
}

function NavItem({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <Box
      as="button"
      onClick={onClick}
      textAlign="left"
      w="full"
      rounded="md"
      px="2"
      py="1.5"
      cursor="pointer"
      bg={selected ? "bg.emphasized" : "transparent"}
      _hover={{ bg: selected ? "bg.emphasized" : "bg.subtle" }}
    >
      {children}
    </Box>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <Box w="1.5" h="1.5" mt="1.5" rounded="full" bg={color} flexShrink="0" />
  );
}

export default function AnalysisNav({
  analysis,
  issues,
  repo,
  prNumber,
  files,
  hasFindings,
  checking,
  issuesError,
  onFindIssues,
  selection,
  onSelect,
}: Props) {
  return (
    <VStack alignItems="stretch" gap="5" px="3" py="4">
      <VStack alignItems="stretch" gap="1">
        <NavItem
          selected={sameSelection(selection, { kind: "summary" })}
          onClick={() => onSelect({ kind: "summary" })}
        >
          <HStack gap="2">
            <Box color="colorPalette.fg" flexShrink="0">
              <LuScrollText size={13} />
            </Box>
            <Text fontSize="xs" fontWeight="medium">
              Summary
            </Text>
          </HStack>
        </NavItem>
      </VStack>

      <VStack alignItems="stretch" gap="1">
        <HStack gap="1">
          <SectionLabel>Issues ({issues.open.length})</SectionLabel>
          <HStack gap="0" ml="auto" mr="1">
            <CopyIssuesButton
              issues={issues.open}
              repo={repo}
              prNumber={prNumber}
              files={files}
            />
            {!checking && (
              <IconButton
                aria-label={hasFindings ? "Re-run findings" : "Find issues"}
                title={
                  hasFindings
                    ? "Re-run the deeper agent pass"
                    : "Run the deeper agent pass over the repo"
                }
                size="2xs"
                variant="ghost"
                color="fg.muted"
                onClick={onFindIssues}
              >
                {hasFindings ? <LuRefreshCw /> : <LuTelescope />}
              </IconButton>
            )}
          </HStack>
        </HStack>

        {issues.open.map((issue) => (
          <NavItem
            key={issue.id}
            selected={sameSelection(selection, { kind: "issue", id: issue.id })}
            onClick={() => onSelect({ kind: "issue", id: issue.id })}
          >
            <HStack gap="2" alignItems="flex-start">
              <Dot color={severityDotColor(issue.severity)} />
              <Text fontSize="xs" flex="1" lineClamp={2}>
                {issue.title}
              </Text>
              {issue.kind === "finding" && (
                <Box color="green.fg" flexShrink="0" title="Verified">
                  <LuBadgeCheck size={13} />
                </Box>
              )}
            </HStack>
          </NavItem>
        ))}

        {checking && (
          <HStack gap="2" px="2" py="1" color="fg.muted">
            <Spinner size="xs" />
            <Text fontSize="xs">Checking the code…</Text>
          </HStack>
        )}

        {issues.open.length === 0 && !checking && (
          <Text fontSize="xs" color="fg.muted" px="2" py="1">
            {hasFindings ? "No issues found." : "Nothing stood out."}
          </Text>
        )}

        {issuesError && (
          <Text fontSize="xs" color="fg.error" px="2" py="1">
            {issuesError}
          </Text>
        )}

        {issues.resolved.length > 0 && (
          <NavItem
            selected={sameSelection(selection, { kind: "resolvedIssues" })}
            onClick={() => onSelect({ kind: "resolvedIssues" })}
          >
            <Text fontSize="xs" color="fg.muted">
              Resolved ({issues.resolved.length})
            </Text>
          </NavItem>
        )}
      </VStack>

      <VStack alignItems="stretch" gap="1">
        <SectionLabel>Reading guide ({analysis.groups.length})</SectionLabel>
        {analysis.groups.map((group, index) => (
          <NavItem
            key={group.id}
            selected={sameSelection(selection, { kind: "group", id: group.id })}
            onClick={() => onSelect({ kind: "group", id: group.id })}
          >
            <HStack gap="2" alignItems="flex-start">
              <Text
                fontFamily="mono"
                fontSize="xs"
                color="fg.subtle"
                flexShrink="0"
              >
                {index + 1}
              </Text>
              <Text fontSize="xs" flex="1" lineClamp={2}>
                {group.title}
              </Text>
              <Dot color={riskDotColor[group.risk]} />
            </HStack>
          </NavItem>
        ))}
      </VStack>

      <VStack alignItems="stretch" gap="1">
        <SectionLabel>
          Behavior changes ({analysis.behaviorChanges.length})
        </SectionLabel>
        {analysis.behaviorChanges.length === 0 ? (
          <Text fontSize="xs" color="fg.muted" px="2" py="1">
            None identified.
          </Text>
        ) : (
          analysis.behaviorChanges.map((claim, index) => (
            <NavItem
              // biome-ignore lint/suspicious/noArrayIndexKey: claims have no stable id
              key={index}
              selected={sameSelection(selection, { kind: "behavior", index })}
              onClick={() => onSelect({ kind: "behavior", index })}
            >
              <HStack gap="2" alignItems="flex-start">
                <Dot color="teal.solid" />
                <Text fontSize="xs" lineClamp={2}>
                  {claim.title}
                </Text>
              </HStack>
            </NavItem>
          ))
        )}
      </VStack>
    </VStack>
  );
}
