import { Box, Flex, Heading, Input, Text, VStack } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ChatMessage, PullRequest } from "../../../shared/types";
import { scrollbar } from "../lib/scrollbar";

interface Props {
  pr: PullRequest;
}

export default function ReviewPanel({ pr }: Props) {
  const [messages, setMessages] = useState<Array<ChatMessage & { id: string }>>(
    [],
  );
  const [question, setQuestion] = useState("");

  const analysisQuery = useQuery({
    queryKey: ["analysis", pr.repo, pr.number],
    queryFn: () => window.api.openPullRequest(pr.repo, pr.number),
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
        <Text fontSize="sm">
          {analysisQuery.data?.summaries?.overview ?? "Generating…"}
        </Text>
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
