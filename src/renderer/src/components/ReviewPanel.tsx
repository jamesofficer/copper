import {
  Box,
  Button,
  Center,
  Flex,
  Heading,
  HStack,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuPanelRightOpen,
  LuSparkles,
  LuTelescope,
  LuTriangleAlert,
} from "react-icons/lu";
import type { PullRequest } from "../../../shared/types";
import { startAnalysis, useAnalysisJob } from "../lib/analysisJobs";
import type { AskContext, AskRequest } from "../lib/askContext";
import { hotkeys } from "../lib/hotkeys";
import { cleanIpcError } from "../lib/ipcError";
import { buildIssues } from "../lib/issues";
import { scrollbar } from "../lib/scrollbar";
import { usePanelWidth } from "../lib/usePanelWidth";
import AnalysisDetail from "./AnalysisDetail";
import AnalysisNav, { type AnalysisSelection } from "./AnalysisNav";
import ChatPanel from "./ChatPanel";
import ReanalyzeButton from "./ReanalyzeButton";
import ResizeHandle from "./ResizeHandle";

interface Props {
  pr: PullRequest;
}

const CHAT_COLLAPSED_KEY = "chatPanelCollapsed";

export default function ReviewPanel({ pr }: Props) {
  const [selection, setSelection] = useState<AnalysisSelection>({
    kind: "summary",
  });
  const { width: chatWidth, startResize: startChatResize } = usePanelWidth({
    storageKey: "chatPanelWidth",
    min: 280,
    max: 640,
    fallback: 420,
    handle: "left",
  });
  const [chatCollapsed, setChatCollapsed] = useState(
    () => localStorage.getItem(CHAT_COLLAPSED_KEY) === "true",
  );
  const [askRequest, setAskRequest] = useState<AskRequest | null>(null);
  const selectedAnalysisRef = useRef<string | undefined>(undefined);
  const queryClient = useQueryClient();

  function collapseChat(collapsed: boolean) {
    setChatCollapsed(collapsed);
    localStorage.setItem(CHAT_COLLAPSED_KEY, String(collapsed));
  }

  function askAbout(context: AskContext, question?: string) {
    setAskRequest({ id: crypto.randomUUID(), context, question });
    if (chatCollapsed) collapseChat(false);
  }

  const analysisQuery = useQuery({
    queryKey: ["analysis", pr.repo, pr.number],
    queryFn: () => window.api.getAnalysis(pr.repo, pr.number),
  });
  const analysis = analysisQuery.data;

  const filesQuery = useQuery({
    queryKey: ["pullRequestFiles", pr.repo, pr.number],
    queryFn: () => window.api.listPullRequestFiles(pr.repo, pr.number),
    enabled: Boolean(analysis),
  });

  // The findings pass. The query is cache-only; the model runs through the
  // mutation below — automatically after an analysis, or from the nav.
  const findingsQuery = useQuery({
    queryKey: ["findings", pr.repo, pr.number],
    queryFn: () => window.api.getFindings(pr.repo, pr.number),
    enabled: Boolean(analysis),
  });

  // Live detail, to spot an analysis that's behind the PR's current commit.
  // Shares its query key with the Overview tab and recents.
  const detailQuery = useQuery({
    queryKey: ["pullRequest", pr.repo, pr.number],
    queryFn: () => window.api.peekPullRequest(pr.repo, pr.number),
  });

  const llmQuery = useQuery({
    queryKey: ["llmStatus"],
    queryFn: () => window.api.getLlmStatus(),
  });
  const currentHeadSha = detailQuery.data?.headSha;
  const analysisOutdated = Boolean(
    analysis && currentHeadSha && analysis.headSha !== currentHeadSha,
  );

  // Runs the findings pass. Shares its mutation key with ReanalyzeButton's
  // chained run, so useIsMutating sees both.
  const findIssuesMutation = useMutation({
    mutationKey: ["findIssues", pr.repo, pr.number],
    mutationFn: (force: boolean) =>
      window.api.findIssues(pr.repo, pr.number, force),
    onSuccess: (result) => {
      queryClient.setQueryData(["findings", pr.repo, pr.number], result);
    },
  });

  // The analysis runs as a background job, so it keeps going — and keeps
  // reporting — after you leave this screen. A deep review chases itself with
  // the findings pass.
  const job = useAnalysisJob(pr.repo, pr.number);
  const manualCheck =
    useIsMutating({ mutationKey: ["findIssues", pr.repo, pr.number] }) > 0;
  const analyzing = job?.stage === "analysing";
  const checking = job?.stage === "checking" || manualCheck;

  const findings = findingsQuery.data ?? null;

  // Which commit each kind of anchor was measured against. Built here, the one
  // place that holds the analysis, the findings run and the PR's head at once,
  // and handed to every copy path — the nav's copy-all and each issue's own
  // button — so the two can't disagree about whether a line still points at the
  // code it was reported against.
  const anchorCommits = useMemo(
    () => ({
      analysisSha: analysis?.headSha ?? "",
      findingsSha: findings?.headSha ?? null,
      currentSha: currentHeadSha,
    }),
    [analysis?.headSha, findings?.headSha, currentHeadSha],
  );

  const issues = useMemo(
    () =>
      analysis
        ? buildIssues(analysis, findings, checking)
        : { open: [], resolved: [] },
    [analysis, findings, checking],
  );
  const chatScope = useMemo(() => {
    if (selection.kind !== "issue") return null;
    const issue = [...issues.open, ...issues.resolved].find(
      (entry) => entry.id === selection.id,
    );
    if (!issue) return null;
    return issue.kind === "finding"
      ? {
          label: "issue" as const,
          title: issue.title,
          text: issue.finding.body,
          anchors: [{ path: issue.finding.path, line: issue.finding.line }],
        }
      : {
          label: "issue" as const,
          title: issue.title,
          text: issue.risk.text,
          anchors: issue.risk.anchors,
        };
  }, [issues, selection]);
  const openIssueIndex =
    selection.kind === "issue"
      ? issues.open.findIndex((issue) => issue.id === selection.id)
      : -1;
  const canCycleIssues = openIssueIndex !== -1 && issues.open.length > 1;

  function cycleIssue(offset: -1 | 1) {
    if (!canCycleIssues) return;
    const nextIndex =
      (openIssueIndex + offset + issues.open.length) % issues.open.length;
    setSelection({ kind: "issue", id: issues.open[nextIndex].id });
  }

  function cycleIssueFromHotkey(event: KeyboardEvent, offset: -1 | 1) {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }
    event.preventDefault();
    cycleIssue(offset);
  }

  useHotkey(hotkeys.previousIssue, (event) => cycleIssueFromHotkey(event, -1), {
    enabled: canCycleIssues,
    meta: { name: "Previous issue" },
  });
  useHotkey(hotkeys.nextIssue, (event) => cycleIssueFromHotkey(event, 1), {
    enabled: canCycleIssues,
    meta: { name: "Next issue" },
  });

  // A new analysis replaces the old items; start with the most severe open
  // issue so the review begins with the action that needs attention.
  const analyzedAt = analysis?.analyzedAt;
  useEffect(() => {
    if (analyzedAt && selectedAnalysisRef.current !== analyzedAt) {
      selectedAnalysisRef.current = analyzedAt;
      const firstIssue = issues.open[0];
      setSelection(
        firstIssue ? { kind: "issue", id: firstIssue.id } : { kind: "summary" },
      );
    }
  }, [analyzedAt, issues.open]);

  if (analysisQuery.isPending) {
    return (
      <Center h="full">
        <HStack color="fg.muted">
          <Spinner size="sm" />
          <Text fontSize="sm">Checking for an existing analysis…</Text>
        </HStack>
      </Center>
    );
  }

  if (analysisQuery.isError) {
    return (
      <Center h="full" p="8">
        <Text fontSize="sm" color="fg.error" textAlign="center">
          {analysisQuery.error instanceof Error
            ? analysisQuery.error.message
            : "Couldn't check for an existing analysis."}
        </Text>
      </Center>
    );
  }

  if (!analysis) {
    return (
      <Center h="full" p="8">
        <VStack gap="4" maxW="md" textAlign="center">
          <Box color="colorPalette.fg">
            <LuSparkles size={28} />
          </Box>
          <Heading size="md">Review this pull request</Heading>
          <Text fontSize="sm" color="fg.muted">
            Claude reads the full diff and builds a guided review: a summary,
            candidate issues for you to verify, and the changes grouped into a
            reading order — every claim tied to the code it came from.
          </Text>

          <HStack gap="3" pt="1">
            <Button
              variant="outline"
              onClick={() => void startAnalysis(pr, "quick")}
              loading={Boolean(job)}
              loadingText="Reviewing…"
            >
              <LuSparkles />
              Quick review
            </Button>
            <Button
              onClick={() => void startAnalysis(pr, "deep")}
              loading={Boolean(job)}
              loadingText="Reviewing…"
            >
              <LuTelescope />
              Deep review
            </Button>
          </HStack>

          <VStack gap="1.5" fontSize="xs" color="fg.subtle" textAlign="left">
            <Text>
              <Text as="span" fontWeight="medium" color="fg.muted">
                Quick
              </Text>{" "}
              reads the diff — summary, reading order, and the risks it spots.
            </Text>
            <Text textAlign="center">
              <Text as="span" fontWeight="medium" color="fg.muted">
                Deep
              </Text>{" "}
              also searches the repo beyond the diff to check each risk and find
              callers the PR missed. Slower, and about twice the cost.
            </Text>
          </VStack>

          <Text fontSize="xs" color="fg.subtle">
            {analyzing
              ? "This can take a minute on large PRs."
              : llmQuery.data?.effective === "claude-code"
                ? "Runs on your Claude plan through Claude Code. Results are cached per commit."
                : "Uses your Claude API key. Results are cached per commit."}
          </Text>
        </VStack>
      </Center>
    );
  }

  return (
    <Flex direction="column" h="full" minH="0">
      {analysisOutdated && (
        <HStack
          gap="2"
          px="4"
          py="2"
          borderBottomWidth="1px"
          bg="bg.subtle"
          flexShrink="0"
        >
          <Box color="orange.fg" flexShrink="0">
            <LuTriangleAlert size={14} />
          </Box>
          <Text fontSize="sm" color="fg.muted">
            This analysis is from an older commit (
            {analysis.headSha.slice(0, 7)}) — the PR has new commits since, so
            line references may be off.
          </Text>
          <Box ml="auto" flexShrink="0">
            <ReanalyzeButton pr={pr} size="2xs" />
          </Box>
        </HStack>
      )}

      <Flex flex="1" minH="0">
        <Box
          w="320px"
          flexShrink="0"
          borderRightWidth="1px"
          overflowY="auto"
          css={scrollbar}
        >
          <AnalysisNav
            analysis={analysis}
            issues={issues}
            repo={pr.repo}
            prNumber={pr.number}
            files={filesQuery.data}
            anchorCommits={anchorCommits}
            hasFindings={Boolean(findings)}
            checking={checking}
            issuesError={
              findIssuesMutation.isError
                ? findIssuesMutation.error instanceof Error
                  ? cleanIpcError(findIssuesMutation.error.message)
                  : "The findings run failed."
                : null
            }
            onFindIssues={() => findIssuesMutation.mutate(Boolean(findings))}
            selection={selection}
            onSelect={setSelection}
          />
        </Box>

        <Box flex="1" minW="0" overflowY="auto" css={scrollbar}>
          <AnalysisDetail
            pr={pr}
            analysis={analysis}
            findings={findings}
            issues={issues}
            files={filesQuery.data}
            anchorCommits={anchorCommits}
            currentHeadSha={currentHeadSha}
            selection={selection}
            onSelect={setSelection}
            onAskAbout={askAbout}
          />
        </Box>

        {chatCollapsed ? (
          <Flex
            as="button"
            onClick={() => collapseChat(false)}
            direction="column"
            alignItems="center"
            gap="3"
            w="9"
            py="3"
            flexShrink="0"
            borderLeftWidth="1px"
            cursor="pointer"
            color="fg.muted"
            _hover={{ bg: "bg.subtle" }}
            title="Expand chat"
          >
            <LuPanelRightOpen size={14} />
            <Text
              fontSize="2xs"
              fontWeight="semibold"
              textTransform="uppercase"
              letterSpacing="wider"
              style={{ writingMode: "vertical-rl" }}
            >
              Ask
            </Text>
          </Flex>
        ) : (
          <Flex flexShrink="0" style={{ width: chatWidth }}>
            <ResizeHandle onPointerDown={startChatResize} />
            <Box flex="1" minW="0" borderLeftWidth="1px">
              <ChatPanel
                pr={pr}
                onCollapse={() => collapseChat(true)}
                askRequest={askRequest}
                onClearAskRequest={() => setAskRequest(null)}
                scope={chatScope}
              />
            </Box>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}
