import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  IconButton,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LuBadgeCheck,
  LuCheck,
  LuChevronLeft,
  LuChevronRight,
  LuCopy,
  LuMessageSquarePlus,
  LuShieldCheck,
  LuUndo2,
  LuX,
} from "react-icons/lu";
import type {
  DraftReviewComment,
  PullRequestFile,
  ReviewFinding,
} from "../../../shared/types";
import type { AskContext } from "../lib/askContext";
import {
  anchorsMayHaveMoved,
  type IssueAnchorCommits,
  issueToMarkdown,
} from "../lib/issueMarkdown";
import {
  categoryMeta,
  issueVerdict,
  type ReviewIssue,
  verdictMeta,
} from "../lib/issues";
import { useCopyToClipboard } from "../lib/useCopyToClipboard";
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

interface Props {
  issue: ReviewIssue;
  repo: string;
  prNumber: number;
  // Full head SHA a drafted comment anchors to.
  commitId: string;
  // False when the findings run is behind the PR's current commit — the line
  // anchor may be wrong, so drafting is blocked until a re-run.
  canDraft: boolean;
  // The same staleness facts the draft guard uses, for the copy button: a
  // snippet cut at a line measured against an older commit can hold unrelated
  // code, so the copy omits it and says why.
  anchorCommits: IssueAnchorCommits;
  files: PullRequestFile[] | undefined;
  fileByPath: FileMap;
  issuePosition?: {
    current: number;
    total: number;
    onPrevious(): void;
    onNext(): void;
  };
  onAskAbout(context: AskContext, question?: string): void;
}

function VerdictBadge({ issue }: { issue: ReviewIssue }) {
  const verdict = issueVerdict(issue);
  const meta = verdictMeta[verdict];
  return (
    <Badge
      colorPalette={meta.palette}
      variant={meta.solid ? "surface" : "outline"}
      size="lg"
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
  anchorCommits,
  files,
  fileByPath,
  issuePosition,
  onAskAbout,
}: Props) {
  const queryClient = useQueryClient();
  const resolve = useIssueResolution(repo, prNumber);
  const clipboard = useCopyToClipboard({
    errorTitle: "Couldn’t copy the issue",
  });

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

  // Same fact the markdown acts on, so the tooltip can't promise code the
  // document then leaves out.
  const copyOmitsCode = anchorsMayHaveMoved(issue, anchorCommits);

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
    <VStack alignItems="stretch" gap="6">
      <VStack alignItems="stretch" gap="5" maxW="4xl">
        <VStack alignItems="stretch" gap="3">
          <HStack gap="2.5">
            <RiskSeverityBadge severity={issue.severity} size="lg" />
            {finding && (
              <Badge
                colorPalette={categoryMeta[finding.category].palette}
                variant="surface"
                size="lg"
              >
                {categoryMeta[finding.category].label}
              </Badge>
            )}
            <VerdictBadge issue={issue} />
            {issuePosition && (
              <HStack gap="1" ml="auto">
                <IconButton
                  aria-label="Previous issue"
                  title="Previous issue"
                  size="sm"
                  variant="ghost"
                  color="fg.muted"
                  disabled={issuePosition.current === 1}
                  onClick={issuePosition.onPrevious}
                >
                  <LuChevronLeft />
                </IconButton>
                <Text
                  minW="24"
                  textAlign="center"
                  fontSize="sm"
                  fontWeight="medium"
                  color="fg.muted"
                >
                  Issue {issuePosition.current} of {issuePosition.total}
                </Text>
                <IconButton
                  aria-label="Next issue"
                  title="Next issue"
                  size="sm"
                  variant="ghost"
                  color="fg.muted"
                  disabled={issuePosition.current === issuePosition.total}
                  onClick={issuePosition.onNext}
                >
                  <LuChevronRight />
                </IconButton>
              </HStack>
            )}
          </HStack>
          <HStack gap="4" alignItems="center">
            <Heading size="2xl" letterSpacing="tight" flex="1" minW="0">
              {issue.title}
            </Heading>
          </HStack>
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

        {!resolution && !cleared && (
          <Box
            borderWidth="1px"
            borderColor={`${issue.severity === "high" ? "red" : "orange"}.emphasized`}
            bg={`${issue.severity === "high" ? "red" : "orange"}.subtle`}
            rounded="md"
            px="3"
            py="2.5"
          >
            <Text fontSize="sm" color="fg.muted">
              {issue.kind === "finding"
                ? "This finding needs review before it becomes a comment on the pull request."
                : "This is a candidate issue from the diff review. Run a deeper check to verify it."}
            </Text>
          </Box>
        )}

        <Markdown fontSize="md">
          {issue.kind === "finding" ? issue.finding.body : issue.risk.text}
        </Markdown>

        <HStack justifyContent="space-between" gap="3" alignItems="center">
          {issue.kind === "risk" ? <AnchorChips claim={issue.risk} /> : <Box />}
          <Button
            size="xs"
            variant="outline"
            color="fg.muted"
            flexShrink="0"
            title={
              copyOmitsCode
                ? "Copy issue details — the findings run is behind the branch, so the code isn’t quoted"
                : "Copy issue details — to paste into an agent or a message"
            }
            onClick={() =>
              void clipboard.copy(
                issueToMarkdown(issue, {
                  repo,
                  prNumber,
                  fileByPath,
                  ...anchorCommits,
                }),
              )
            }
          >
            {clipboard.copied ? <LuCheck /> : <LuCopy />}
            Copy issue details
          </Button>
        </HStack>

        {finding && (
          <Box borderWidth="1px" rounded="md" p="3" bg="bg.subtle">
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
