import {
  Badge,
  Box,
  Heading,
  HStack,
  Spinner,
  Text,
  VStack,
  Wrap,
} from "@chakra-ui/react";
import type { ReactNode } from "react";
import type {
  AnalysisClaim,
  AnalysisResult,
  PullRequestFile,
} from "../../../shared/types";
import FileDiffCard from "./FileDiffCard";
import Markdown from "./Markdown";
import RiskBadge from "./RiskBadge";

interface Props {
  analysis: AnalysisResult;
  files: PullRequestFile[] | undefined;
}

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
// embedded diff in the reading guide below.
function AnchorChips({ claim }: { claim: AnalysisClaim }) {
  if (claim.anchors.length === 0) return null;
  return (
    <Wrap gap="1.5" mt="2">
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

function ClaimList({
  claims,
  emptyText,
}: {
  claims: AnalysisClaim[];
  emptyText: string;
}) {
  if (claims.length === 0) {
    return (
      <Text fontSize="sm" color="fg.muted">
        {emptyText}
      </Text>
    );
  }
  return (
    <VStack alignItems="stretch" gap="4">
      {claims.map((claim, index) => (
        <Box
          // biome-ignore lint/suspicious/noArrayIndexKey: claims have no stable id
          key={index}
          borderLeftWidth="2px"
          borderColor="border.emphasized"
          pl="3"
        >
          <Markdown>{claim.text}</Markdown>
          <AnchorChips claim={claim} />
        </Box>
      ))}
    </VStack>
  );
}

export default function AnalysisView({ analysis, files }: Props) {
  const fileByPath = new Map(
    (files ?? []).map((file) => [file.path, file] as const),
  );

  return (
    <VStack alignItems="stretch" gap="8">
      <VStack alignItems="stretch" gap="3">
        <SectionHeading>Summary</SectionHeading>
        <Markdown>{analysis.summary}</Markdown>
      </VStack>

      <VStack alignItems="stretch" gap="3">
        <SectionHeading>Risks</SectionHeading>
        <ClaimList
          claims={analysis.risks}
          emptyText="Nothing stood out in this diff."
        />
      </VStack>

      <VStack alignItems="stretch" gap="3">
        <SectionHeading>Behavior changes</SectionHeading>
        <ClaimList
          claims={analysis.behaviorChanges}
          emptyText="No behavior changes identified."
        />
      </VStack>

      {analysis.outOfScope.length > 0 && (
        <VStack alignItems="stretch" gap="3">
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

      <VStack alignItems="stretch" gap="5">
        <SectionHeading>Reading guide</SectionHeading>
        {!files && (
          <HStack color="fg.muted">
            <Spinner size="sm" />
            <Text fontSize="sm">Loading diffs…</Text>
          </HStack>
        )}
        {analysis.groups.map((group, index) => (
          <VStack key={group.id} alignItems="stretch" gap="3">
            <HStack gap="3" alignItems="baseline">
              <Text
                fontFamily="mono"
                fontSize="sm"
                color="fg.subtle"
                flexShrink="0"
              >
                {index + 1}
              </Text>
              <Heading size="sm">{group.title}</Heading>
              <RiskBadge risk={group.risk} />
            </HStack>
            {group.story && (
              <Box pl="6">
                <Markdown>{group.story}</Markdown>
              </Box>
            )}
            {files && (
              <VStack alignItems="stretch" gap="2" pl="6">
                {group.files.map((path) => {
                  const file = fileByPath.get(path);
                  if (!file) return null;
                  return (
                    <FileDiffCard
                      key={path}
                      id={`diff-${path}`}
                      file={file}
                      defaultOpen={group.risk !== "mechanical"}
                    />
                  );
                })}
              </VStack>
            )}
          </VStack>
        ))}
      </VStack>

      <Text fontSize="xs" color="fg.subtle" fontFamily="mono">
        Analysed commit {analysis.headSha.slice(0, 7)} · {analysis.model}
      </Text>
    </VStack>
  );
}
