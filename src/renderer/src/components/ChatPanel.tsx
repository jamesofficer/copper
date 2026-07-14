import { Box, Flex, Heading, Input, Text, VStack } from "@chakra-ui/react";
import { useState } from "react";
import type { ChatMessage, PullRequest } from "../../../shared/types";
import { scrollbar } from "../lib/scrollbar";

interface Props {
  pr: PullRequest;
}

export default function ChatPanel({ pr }: Props) {
  const [messages, setMessages] = useState<Array<ChatMessage & { id: string }>>(
    [],
  );
  const [question, setQuestion] = useState("");

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
    <Flex direction="column" h="full" minH="0">
      <Heading
        size="xs"
        color="fg.muted"
        textTransform="uppercase"
        letterSpacing="wider"
        px="4"
        py="3"
        flexShrink="0"
      >
        Ask
      </Heading>

      <VStack
        flex="1"
        minH="0"
        overflowY="auto"
        alignItems="stretch"
        gap="3"
        px="4"
        pb="3"
        css={scrollbar}
      >
        {messages.length === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            Ask anything about this PR — what a change does, why it's there,
            what it might affect.
          </Text>
        ) : (
          messages.map((message) => (
            <Text
              key={message.id}
              fontSize="sm"
              color={message.role === "user" ? "colorPalette.fg" : "fg"}
            >
              {message.content}
            </Text>
          ))
        )}
      </VStack>

      <Box p="3" borderTopWidth="1px" flexShrink="0">
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
    </Flex>
  );
}
