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
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { LuPanelRightOpen, LuSparkles, LuTriangleAlert } from "react-icons/lu";
import type {
  PullRequest,
  RiskClaim,
  RiskSeverity,
} from "../../../shared/types";
import type { AskContext, AskRequest } from "../lib/askContext";
import { getReviewPersonality } from "../lib/reviewPersonality";
import { scrollbar } from "../lib/scrollbar";
import { usePanelWidth } from "../lib/usePanelWidth";
import AnalysisDetail from "./AnalysisDetail";
import AnalysisNav, { type AnalysisSelection } from "./AnalysisNav";
import ChatPanel from "./ChatPanel";
import ReanalyzeButton from "./ReanalyzeButton";

interface Props {
  pr: PullRequest;
}

const CHAT_COLLAPSED_KEY = "chatPanelCollapsed";

const severityRank: Record<RiskSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// Sort is stable, so risks without a severity (older cached analyses) keep
// the model's order; classified ones rank high → medium → low.
function sortRisksBySeverity(risks: RiskClaim[]): RiskClaim[] {
  return [...risks].sort(
    (a, b) =>
      severityRank[a.severity ?? "medium"] -
      severityRank[b.severity ?? "medium"],
  );
}

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
  const analysis = useMemo(() => {
    const data = analysisQuery.data;
    if (!data) return data;
    return { ...data, risks: sortRisksBySeverity(data.risks) };
  }, [analysisQuery.data]);

  const filesQuery = useQuery({
    queryKey: ["pullRequestFiles", pr.repo, pr.number],
    queryFn: () => window.api.listPullRequestFiles(pr.repo, pr.number),
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

  const analyzeMutation = useMutation({
    mutationKey: ["analyzePr", pr.repo, pr.number],
    mutationFn: () =>
      window.api.analyzePullRequest(pr.repo, pr.number, getReviewPersonality()),
    onSuccess: (result) => {
      queryClient.setQueryData(["analysis", pr.repo, pr.number], result);
      void queryClient.invalidateQueries({
        queryKey: ["analyzedPullRequests"],
      });
    },
  });

  // Covers both this button and the header's Re-analyse, which share the key.
  const analyzing =
    useIsMutating({ mutationKey: ["analyzePr", pr.repo, pr.number] }) > 0;

  // A new analysis replaces the old items; start reading from the summary.
  const analyzedAt = analysis?.analyzedAt;
  useEffect(() => {
    if (analyzedAt) setSelection({ kind: "summary" });
  }, [analyzedAt]);

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
        <VStack gap="4" maxW="sm" textAlign="center">
          <Box color="colorPalette.fg">
            <LuSparkles size={28} />
          </Box>
          <Heading size="md">Analyse this pull request</Heading>
          <Text fontSize="sm" color="fg.muted">
            Claude reads the full diff and builds a guided review: a summary,
            the risks, and the changes grouped into a reading order — every
            claim tied to the code it came from.
          </Text>
          <Button
            onClick={() => analyzeMutation.mutate()}
            loading={analyzing}
            loadingText="Analysing…"
          >
            <LuSparkles />
            Analyse PR
          </Button>
          <Text fontSize="xs" color="fg.subtle">
            {analyzing
              ? "This can take a minute on large PRs."
              : llmQuery.data?.effective === "claude-code"
                ? "Runs on your Claude plan through Claude Code. Results are cached per commit."
                : "Uses your Claude API key. Results are cached per commit."}
          </Text>
          {analyzeMutation.isError && (
            <Text fontSize="sm" color="fg.error">
              {analyzeMutation.error instanceof Error
                ? analyzeMutation.error.message
                : "Analysis failed."}
            </Text>
          )}
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
          w="300px"
          flexShrink="0"
          borderRightWidth="1px"
          overflowY="auto"
          css={scrollbar}
        >
          <AnalysisNav
            analysis={analysis}
            selection={selection}
            onSelect={setSelection}
          />
        </Box>

        <Box flex="1" minW="0" overflowY="auto" css={scrollbar}>
          <AnalysisDetail
            analysis={analysis}
            files={filesQuery.data}
            selection={selection}
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
            <Box
              w="1"
              flexShrink="0"
              cursor="col-resize"
              onPointerDown={startChatResize}
              _hover={{ bg: "border.emphasized" }}
              transition="background 0.15s"
            />
            <Box flex="1" minW="0" borderLeftWidth="1px">
              <ChatPanel
                pr={pr}
                onCollapse={() => collapseChat(true)}
                askRequest={askRequest}
                onClearAskRequest={() => setAskRequest(null)}
              />
            </Box>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}
