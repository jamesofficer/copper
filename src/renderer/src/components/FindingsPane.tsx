import {
  Box,
  Button,
  Collapsible,
  Heading,
  HStack,
  Icon,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LuChevronRight,
  LuRefreshCw,
  LuShieldCheck,
  LuTelescope,
  LuTriangleAlert,
} from "react-icons/lu";
import type {
  FindingsResult,
  PullRequest,
  PullRequestFile,
} from "../../../shared/types";
import FindingCard from "./FindingCard";

interface Props {
  pr: PullRequest;
  findings: FindingsResult | null;
  files: PullRequestFile[] | undefined;
  // The PR's current head SHA — the anchor for new draft comments, and what
  // tells us the findings run is stale.
  currentHeadSha: string | undefined;
  claudeCode: boolean;
}

export default function FindingsPane({
  pr,
  findings,
  files,
  currentHeadSha,
  claudeCode,
}: Props) {
  const queryClient = useQueryClient();
  const [showResolved, setShowResolved] = useState(false);
  const fileByPath = new Map((files ?? []).map((file) => [file.path, file]));

  const run = useMutation({
    mutationKey: ["findIssues", pr.repo, pr.number],
    mutationFn: (force: boolean) =>
      window.api.findIssues(pr.repo, pr.number, force),
    onSuccess: (result) => {
      queryClient.setQueryData(["findings", pr.repo, pr.number], result);
    },
  });

  const running = run.isPending;

  if (!findings) {
    return (
      <Box px="2" py="4">
        <VStack gap="4" maxW="md" textAlign="center" mx="auto" py="10">
          <Box color="colorPalette.fg">
            <LuTelescope size={28} />
          </Box>
          <Heading size="md">Find issues</Heading>
          <Text fontSize="sm" color="fg.muted">
            Claude reviews the diff and the wider repo — tracing changed
            functions to their callers — and flags candidate issues for you to
            verify. Nothing is posted: accept a finding to turn it into a draft
            comment, or dismiss it.
          </Text>
          <Button
            onClick={() => run.mutate(false)}
            loading={running}
            loadingText="Looking for issues…"
          >
            <LuTelescope /> Find issues
          </Button>
          <Text fontSize="xs" color="fg.subtle">
            {running
              ? "This runs the agent over the repo — it can take a minute."
              : claudeCode
                ? "Runs on your Claude plan through Claude Code. Cached per commit."
                : "Uses your Claude API key. Cached per commit."}
          </Text>
          {run.isError && (
            <Text fontSize="sm" color="fg.error">
              {run.error instanceof Error
                ? run.error.message
                : "The findings run failed."}
            </Text>
          )}
        </VStack>
      </Box>
    );
  }

  const outdated = Boolean(
    currentHeadSha && findings.headSha !== currentHeadSha,
  );
  const open = findings.findings.filter((finding) => !finding.resolution);
  const resolved = findings.findings.filter((finding) => finding.resolution);
  const commitId = currentHeadSha ?? findings.headSha;

  return (
    <VStack alignItems="stretch" gap="4" maxW="3xl">
      <HStack gap="3">
        <Heading size="md">Issues found ({open.length})</Heading>
        <Button
          size="xs"
          variant="outline"
          ml="auto"
          loading={running}
          loadingText="Re-running…"
          onClick={() => run.mutate(true)}
        >
          <LuRefreshCw /> Re-run
        </Button>
      </HStack>

      {outdated && (
        <HStack gap="2" px="3" py="2" rounded="md" bg="bg.subtle">
          <Box color="orange.fg" flexShrink="0">
            <LuTriangleAlert size={14} />
          </Box>
          <Text fontSize="sm" color="fg.muted">
            These findings are from an older commit (
            {findings.headSha.slice(0, 7)}). Re-run to check the latest changes
            and enable drafting comments.
          </Text>
        </HStack>
      )}

      {run.isError && (
        <Text fontSize="sm" color="fg.error">
          {run.error instanceof Error ? run.error.message : "Re-run failed."}
        </Text>
      )}

      {open.length === 0 ? (
        <HStack
          gap="3"
          px="4"
          py="6"
          rounded="lg"
          borderWidth="1px"
          color="fg.muted"
        >
          <Icon color="green.fg" flexShrink="0">
            <LuShieldCheck size={20} />
          </Icon>
          <Text fontSize="sm">
            {findings.findings.length === 0
              ? "No issues flagged. The agent didn’t find anything worth raising in this diff."
              : "No open findings — you’ve handled every issue the agent raised."}
          </Text>
        </HStack>
      ) : (
        <VStack alignItems="stretch" gap="3">
          {open.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              repo={pr.repo}
              prNumber={pr.number}
              commitId={commitId}
              file={fileByPath.get(finding.path)}
              canDraft={!outdated}
            />
          ))}
        </VStack>
      )}

      {resolved.length > 0 && (
        <Collapsible.Root
          open={showResolved}
          onOpenChange={(details) => setShowResolved(details.open)}
        >
          <Collapsible.Trigger cursor="pointer">
            <HStack gap="1.5" color="fg.muted" py="1">
              <Box
                transition="transform 0.15s"
                transform={showResolved ? "rotate(90deg)" : undefined}
              >
                <LuChevronRight size={14} />
              </Box>
              <Text fontSize="sm">Resolved ({resolved.length})</Text>
            </HStack>
          </Collapsible.Trigger>
          <Collapsible.Content>
            <VStack alignItems="stretch" gap="2" pt="2">
              {resolved.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  repo={pr.repo}
                  prNumber={pr.number}
                  commitId={commitId}
                  file={fileByPath.get(finding.path)}
                  canDraft={!outdated}
                />
              ))}
            </VStack>
          </Collapsible.Content>
        </Collapsible.Root>
      )}

      <Text fontSize="xs" color="fg.subtle" fontFamily="mono">
        Ran on commit {findings.headSha.slice(0, 7)} · {findings.model}
      </Text>
    </VStack>
  );
}
