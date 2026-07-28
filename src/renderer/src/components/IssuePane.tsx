import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LuBadgeCheck,
  LuMessageSquarePlus,
  LuShieldCheck,
  LuUndo2,
  LuX,
} from "react-icons/lu";
import type {
  DraftReviewComment,
  FindingCategory,
  PullRequestFile,
  ReviewFinding,
} from "../../../shared/types";
import type { AskContext } from "../lib/askContext";
import {
  type IssueVerdict,
  issueVerdict,
  type ReviewIssue,
} from "../lib/issues";
import { useIssueResolution } from "../lib/useIssueResolution";
import {
  AnchorChips,
  AskAboutButton,
  DiffCards,
  type FileMap,
  LoadingDiffs,
  SectionHeading,
} from "./AnalysisShared";
import Markdown from "./Markdown";
import RiskSeverityBadge from "./RiskSeverityBadge";
import { toaster } from "./ui/toaster";

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

interface Props {
  issue: ReviewIssue;
  repo: string;
  prNumber: number;
  // Full head SHA a drafted comment anchors to.
  commitId: string;
  // False when the findings run is behind the PR's current commit — the line
  // anchor may be wrong, so drafting is blocked until a re-run.
  canDraft: boolean;
  files: PullRequestFile[] | undefined;
  fileByPath: FileMap;
  onAskAbout(context: AskContext, question?: string): void;
}

// How each verification verdict looks — one place to add new verdicts.
export const verdictMeta: Record<
  IssueVerdict,
  { label: string; palette: string; solid: boolean }
> = {
  verified: { label: "Verified", palette: "green", solid: true },
  non_issue: { label: "Non-issue", palette: "green", solid: true },
  checking: { label: "Checking", palette: "gray", solid: false },
  unverified: { label: "Unverified", palette: "gray", solid: false },
};

function VerdictBadge({ issue }: { issue: ReviewIssue }) {
  const verdict = issueVerdict(issue);
  const meta = verdictMeta[verdict];
  return (
    <Badge
      colorPalette={meta.palette}
      variant={meta.solid ? "surface" : "outline"}
    >
      {verdict === "verified" && <LuBadgeCheck />}
      {verdict === "non_issue" && <LuShieldCheck />}
      {meta.label}
    </Badge>
  );
}

export default function IssuePane({
  issue,
  repo,
  prNumber,
  commitId,
  canDraft,
  files,
  fileByPath,
  onAskAbout,
}: Props) {
  const queryClient = useQueryClient();
  const resolve = useIssueResolution(repo, prNumber);

  // Accept = draft the suggested comment, then mark the finding accepted so
  // it leaves the open list and won't return on a re-run.
  const accept = useMutation({
    mutationFn: async (finding: ReviewFinding) => {
      const created = await window.api.addDraftComment(repo, prNumber, {
        commitId,
        path: finding.path,
        side: "RIGHT",
        line: finding.line,
        startLine: null,
        body: finding.suggestion,
      });
      await window.api.setFindingResolution(
        repo,
        prNumber,
        finding.id,
        "accepted",
      );
      return { created, finding };
    },
    onSuccess: ({ created, finding }) => {
      queryClient.setQueryData<DraftReviewComment[]>(
        ["draftComments", repo, prNumber],
        (existing) => [...(existing ?? []), created],
      );
      void queryClient.invalidateQueries({
        queryKey: ["findings", repo, prNumber],
      });
      toaster.create({
        type: "success",
        title: "Added to your review",
        description: `${finding.path}:${finding.line} — draft comment created.`,
      });
    },
    onError: (cause) => {
      toaster.create({
        type: "error",
        title: "Couldn’t add draft comment",
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
    },
  });

  const finding = issue.kind === "finding" ? issue.finding : null;
  const resolution =
    issue.kind === "finding" ? issue.finding.resolution : issue.risk.resolution;
  const cleared = issue.kind === "risk" && issue.status === "cleared";
  const paths =
    issue.kind === "finding"
      ? [issue.finding.path]
      : [...new Set(issue.risk.anchors.map((anchor) => anchor.path))];
  const askClaim =
    issue.kind === "finding"
      ? {
          title: issue.finding.title,
          text: issue.finding.body,
          anchors: [{ path: issue.finding.path, line: issue.finding.line }],
        }
      : issue.risk;

  return (
    <VStack alignItems="stretch" gap="4">
      <VStack alignItems="stretch" gap="4" maxW="3xl">
        <VStack alignItems="stretch" gap="2">
          <HStack gap="2">
            <RiskSeverityBadge severity={issue.severity} />
            {finding && (
              <Badge
                colorPalette={categoryMeta[finding.category].palette}
                variant="surface"
              >
                {categoryMeta[finding.category].label}
              </Badge>
            )}
            <VerdictBadge issue={issue} />
            {finding && (
              <Text
                fontSize="xs"
                fontFamily="mono"
                color="fg.subtle"
                ml="auto"
                truncate
                title={`${finding.path}:${finding.line}`}
              >
                {finding.path}:{finding.line}
              </Text>
            )}
          </HStack>
          <Heading size="md">{issue.title}</Heading>
        </VStack>

        {resolution && (
          <HStack gap="2" px="3" py="2" rounded="md" bg="bg.subtle">
            <Text fontSize="sm" color="fg.muted" flex="1">
              {resolution === "accepted"
                ? "Added to your review as a draft comment."
                : "You dismissed this issue."}
            </Text>
            <Button
              size="2xs"
              variant="ghost"
              color="fg.muted"
              loading={resolve.isPending}
              onClick={() =>
                resolve.mutate({ id: issue.id, resolution: "open" })
              }
            >
              <LuUndo2 /> Restore
            </Button>
          </HStack>
        )}

        {cleared && (
          <HStack
            gap="2.5"
            px="3"
            py="2.5"
            rounded="md"
            borderWidth="1px"
            borderColor="green.emphasized"
            bg="green.subtle"
            alignItems="flex-start"
          >
            <Box color="green.fg" flexShrink="0" mt="0.5">
              <LuShieldCheck size={14} />
            </Box>
            <VStack alignItems="stretch" gap="0.5">
              <Text
                fontSize="2xs"
                fontWeight="semibold"
                color="green.fg"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                {verdictMeta.non_issue.label}
              </Text>
              <Text fontSize="sm" color="fg.muted">
                {issue.note ||
                  "The agent checked this and it isn't a real problem."}
              </Text>
            </VStack>
          </HStack>
        )}

        {issue.kind === "risk" && issue.status === "checking" && (
          <HStack gap="2" color="fg.muted">
            <Spinner size="xs" />
            <Text fontSize="sm">The agent is checking this one now…</Text>
          </HStack>
        )}

        <Markdown fontSize="md">
          {issue.kind === "finding" ? issue.finding.body : issue.risk.text}
        </Markdown>

        {issue.kind === "risk" && <AnchorChips claim={issue.risk} />}

        {finding && (
          <Box borderLeftWidth="2px" borderColor="border.emphasized" pl="3">
            <Text
              fontSize="2xs"
              fontWeight="semibold"
              color="fg.muted"
              textTransform="uppercase"
              letterSpacing="wider"
              mb="1"
            >
              Suggested comment
            </Text>
            <Markdown fontSize="sm">{finding.suggestion}</Markdown>
          </Box>
        )}

        <HStack gap="2">
          {finding && !resolution && (
            <Button
              size="xs"
              colorPalette="green"
              loading={accept.isPending}
              disabled={!canDraft}
              title={
                canDraft
                  ? undefined
                  : "Re-run findings on the latest commit before drafting."
              }
              onClick={() => accept.mutate(finding)}
            >
              <LuMessageSquarePlus /> Add as draft comment
            </Button>
          )}
          <AskAboutButton
            label="issue"
            claim={askClaim}
            onAskAbout={onAskAbout}
          />
          {!resolution && !cleared && (
            <Button
              size="xs"
              variant="ghost"
              color="fg.muted"
              loading={resolve.isPending}
              // A risk id can be briefly missing on a legacy cached analysis
              // until the backfilled refetch lands.
              disabled={issue.kind === "risk" && !issue.risk.id}
              onClick={() =>
                resolve.mutate({ id: issue.id, resolution: "dismissed" })
              }
            >
              <LuX /> Dismiss
            </Button>
          )}
        </HStack>
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
