import {
  Box,
  Flex,
  Heading,
  HStack,
  IconButton,
  Spinner,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { LuPanelRightClose } from "react-icons/lu";
import type { ChatMessage, PullRequest } from "../../../shared/types";
import { scrollbar } from "../lib/scrollbar";
import Markdown from "./Markdown";

interface Props {
  pr: PullRequest;
  onCollapse(): void;
}

type UiMessage = ChatMessage & { id: string; failed?: boolean };

function cleanIpcError(message: string): string {
  return message.replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    "",
  );
}

export default function ChatPanel({ pr, onCollapse }: Props) {
  // Persisted history from the main process is the base; `local` overlays it
  // once the user starts talking (it also holds streaming + failed messages).
  const [local, setLocal] = useState<UiMessage[] | null>(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const streamingIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const historyQuery = useQuery({
    queryKey: ["chatHistory", pr.repo, pr.number],
    queryFn: () => window.api.getChatHistory(pr.repo, pr.number),
  });

  const messages: UiMessage[] =
    local ??
    (historyQuery.data ?? []).map((message, index) => ({
      ...message,
      id: `history-${index}`,
    }));

  useEffect(() => {
    return window.api.onChatChunk((chunk) => {
      const id = streamingIdRef.current;
      if (!id || chunk.repo !== pr.repo || chunk.prNumber !== pr.number) return;
      setLocal((prev) =>
        prev
          ? prev.map((message) =>
              message.id === id
                ? { ...message, content: message.content + chunk.text }
                : message,
            )
          : prev,
      );
    });
  }, [pr.repo, pr.number]);

  // Keep the newest message in view while an answer streams in.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll reacts to new content
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function ask() {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    setQuestion("");
    setBusy(true);

    const answerId = crypto.randomUUID();
    streamingIdRef.current = answerId;
    setLocal([
      ...messages,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
      { id: answerId, role: "assistant", content: "" },
    ]);

    try {
      const answer = await window.api.askQuestion(pr.repo, pr.number, trimmed);
      setLocal(
        (prev) =>
          prev?.map((message) =>
            message.id === answerId ? { ...message, content: answer } : message,
          ) ?? prev,
      );
      // Sync the persisted history so a remount shows the full conversation.
      void queryClient.invalidateQueries({
        queryKey: ["chatHistory", pr.repo, pr.number],
      });
    } catch (cause) {
      const reason =
        cause instanceof Error
          ? cleanIpcError(cause.message)
          : "Something went wrong.";
      setLocal(
        (prev) =>
          prev?.map((message) =>
            message.id === answerId
              ? { ...message, content: reason, failed: true }
              : message,
          ) ?? prev,
      );
    } finally {
      streamingIdRef.current = null;
      setBusy(false);
    }
  }

  return (
    <Flex direction="column" h="full" minH="0">
      <HStack justifyContent="space-between" pr="2" flexShrink="0">
        <Heading
          size="xs"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
          px="4"
          py="3"
        >
          Ask
        </Heading>
        <IconButton
          aria-label="Collapse chat"
          title="Collapse chat"
          size="2xs"
          variant="ghost"
          color="fg.muted"
          onClick={onCollapse}
        >
          <LuPanelRightClose />
        </IconButton>
      </HStack>

      <VStack
        ref={scrollRef}
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
            what it might affect. The chat sees the diff and the analysis, but
            not the rest of the repository (yet).
          </Text>
        ) : (
          messages.map((message) =>
            message.role === "user" ? (
              <Box
                key={message.id}
                alignSelf="flex-end"
                maxW="90%"
                bg="bg.emphasized"
                rounded="lg"
                px="3"
                py="2"
              >
                <Text fontSize="sm">{message.content}</Text>
              </Box>
            ) : (
              <Box key={message.id}>
                {message.failed ? (
                  <Text fontSize="sm" color="fg.error">
                    {message.content}
                  </Text>
                ) : message.content ? (
                  <Markdown>{message.content}</Markdown>
                ) : (
                  <HStack color="fg.muted">
                    <Spinner size="xs" />
                    <Text fontSize="sm">Thinking…</Text>
                  </HStack>
                )}
              </Box>
            ),
          )
        )}
      </VStack>

      <Box p="3" borderTopWidth="1px" flexShrink="0">
        <Textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void ask();
            }
          }}
          placeholder={busy ? "Answering…" : "Ask about this PR…"}
          disabled={busy}
          size="sm"
          rows={1}
          autoresize
          maxH="40"
        />
      </Box>
    </Flex>
  );
}
