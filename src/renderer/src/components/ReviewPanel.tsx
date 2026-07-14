import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ChatMessage, PullRequest } from "../../../shared/types";
import { scrollbar } from "../lib/scrollbar";
import Markdown from "./Markdown";

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

  const analyzeMutation = useMutation({
    mutationFn: () => window.api.analyzePullRequest(pr.repo, pr.number),
    onSuccess: (result) =>
      queryClient.setQueryData(["analysis", pr.repo, pr.number], result),
  });

  const analysis = analysisQuery.data;

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

  return (
    <Flex
      direction="column"
      h="full"
      maxW="3xl"
      mx="auto"
      w="full"
      px="8"
      py="6"
      minH="0"
    >
      <Box mb="6">
        <Heading
          size="xs"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
          mb="2"
        >
          Summary
        </Heading>
        {/* TODO: temporary raw output — the real Review UI (groups with
            embedded diffs, risk sections) replaces this next. */}
        {analysis ? (
          <VStack alignItems="stretch" gap="2">
            <Markdown>{analysis.summary}</Markdown>
            {analysis.groups.map((group) => (
              <Text key={group.id} fontSize="sm" color="fg.muted">
                {group.title} — {group.risk} ({group.files.length} file
                {group.files.length === 1 ? "" : "s"})
              </Text>
            ))}
          </VStack>
        ) : (
          <VStack alignItems="flex-start" gap="2">
            <Button
              size="sm"
              onClick={() => analyzeMutation.mutate()}
              loading={analyzeMutation.isPending}
              loadingText="Analysing…"
              disabled={analysisQuery.isPending}
            >
              Analyse PR
            </Button>
            {analyzeMutation.isError && (
              <Text fontSize="sm" color="fg.error">
                {analyzeMutation.error instanceof Error
                  ? analyzeMutation.error.message
                  : "Analysis failed."}
              </Text>
            )}
          </VStack>
        )}
      </Box>

      <Flex direction="column" flex="1" minH="0">
        <Heading
          size="xs"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
          mb="2"
        >
          Ask
        </Heading>
        <VStack
          flex="1"
          overflowY="auto"
          alignItems="stretch"
          gap="2"
          mb="3"
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
      </Flex>
    </Flex>
  );
}
