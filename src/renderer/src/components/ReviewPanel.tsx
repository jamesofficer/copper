import {
  Box,
  Button,
  Center,
  Flex,
  Heading,
  HStack,
  Input,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LuSparkles } from "react-icons/lu";
import type { ChatMessage, PullRequest } from "../../../shared/types";
import { scrollbar } from "../lib/scrollbar";
import AnalysisView from "./AnalysisView";

interface Props {
  pr: PullRequest;
}

export default function ReviewPanel({ pr }: Props) {
  const [messages, setMessages] = useState<Array<ChatMessage & { id: string }>>(
    [],
  );
  const [question, setQuestion] = useState("");
  const queryClient = useQueryClient();

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

  const analyzeMutation = useMutation({
    mutationFn: () => window.api.analyzePullRequest(pr.repo, pr.number),
    onSuccess: (result) =>
      queryClient.setQueryData(["analysis", pr.repo, pr.number], result),
  });

  async function ask() {
    const trimmed = question.trim();
    if (!trimmed) return;
    setQuestion("");
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
    ]);
    const answer = await window.api.askQuestion(pr.repo, pr.number, trimmed);
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "assistant", content: answer },
    ]);
  }

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
    <Flex direction="column" h="full" minH="0">
      <Box flex="1" minH="0" overflowY="auto" css={scrollbar}>
        <Box maxW="4xl" mx="auto" px="8" py="8">
          <AnalysisView analysis={analysis} files={filesQuery.data} />
        </Box>
      </Box>

      <Box borderTopWidth="1px" px="8" py="4" flexShrink="0">
        <Box maxW="4xl" mx="auto">
          {messages.length > 0 && (
            <VStack
              alignItems="stretch"
              gap="2"
              mb="3"
              maxH="40"
              overflowY="auto"
              css={scrollbar}
            >
              {messages.map((message) => (
                <Text
                  key={message.id}
                  fontSize="sm"
                  color={message.role === "user" ? "colorPalette.fg" : "fg"}
                >
                  {message.content}
                </Text>
              ))}
            </VStack>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void ask();
            }}
          >
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about this PR…"
              size="sm"
            />
          </form>
        </Box>
      </Box>
    </Flex>
  );
}
