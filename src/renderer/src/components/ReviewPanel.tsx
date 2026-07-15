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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LuPanelRightOpen, LuSparkles } from "react-icons/lu";
import type {
  PullRequest,
  RiskClaim,
  RiskSeverity,
} from "../../../shared/types";
import { getReviewPersonality } from "../lib/reviewPersonality";
import { scrollbar } from "../lib/scrollbar";
import AnalysisDetail from "./AnalysisDetail";
import AnalysisNav, { type AnalysisSelection } from "./AnalysisNav";
import ChatPanel from "./ChatPanel";

interface Props {
  pr: PullRequest;
}

const CHAT_WIDTH_KEY = "chatPanelWidth";
const CHAT_COLLAPSED_KEY = "chatPanelCollapsed";
const CHAT_MIN_WIDTH = 280;
const CHAT_MAX_WIDTH = 640;

function storedChatWidth(): number {
  const stored = Number(localStorage.getItem(CHAT_WIDTH_KEY));
  return stored >= CHAT_MIN_WIDTH && stored <= CHAT_MAX_WIDTH ? stored : 420;
}

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
  const [chatWidth, setChatWidth] = useState(storedChatWidth);
  const [chatCollapsed, setChatCollapsed] = useState(
    () => localStorage.getItem(CHAT_COLLAPSED_KEY) === "true",
  );
  const queryClient = useQueryClient();

  function collapseChat(collapsed: boolean) {
    setChatCollapsed(collapsed);
    localStorage.setItem(CHAT_COLLAPSED_KEY, String(collapsed));
  }

  function startChatResize(event: React.PointerEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = chatWidth;
    let latest = startWidth;

    function onMove(move: PointerEvent) {
      latest = Math.min(
        CHAT_MAX_WIDTH,
        Math.max(CHAT_MIN_WIDTH, startWidth + startX - move.clientX),
      );
      setChatWidth(latest);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      localStorage.setItem(CHAT_WIDTH_KEY, String(latest));
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
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

  const analyzeMutation = useMutation({
    mutationFn: (force: boolean) =>
      window.api.analyzePullRequest(
        pr.repo,
        pr.number,
        getReviewPersonality(),
        force,
      ),
    onSuccess: (result) => {
      queryClient.setQueryData(["analysis", pr.repo, pr.number], result);
      setSelection({ kind: "summary" });
    },
  });

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
            onClick={() => analyzeMutation.mutate(false)}
            loading={analyzeMutation.isPending}
            loadingText="Analysing…"
          >
            <LuSparkles />
            Analyse PR
          </Button>
          <Text fontSize="xs" color="fg.subtle">
            {analyzeMutation.isPending
              ? "This can take a minute on large PRs."
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
    <Flex h="full" minH="0">
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
          onReanalyze={() => analyzeMutation.mutate(true)}
          reanalyzing={analyzeMutation.isPending}
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
            <ChatPanel pr={pr} onCollapse={() => collapseChat(true)} />
          </Box>
        </Flex>
      )}
    </Flex>
  );
}
