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
import {
  LuMessageCircleQuestion,
  LuPanelRightClose,
  LuX,
} from "react-icons/lu";
import type { ChatMessage, PullRequest } from "../../../shared/types";
import {
  type AskRequest,
  buildQuestionWithContext,
  parseQuestion,
} from "../lib/askContext";
import { cleanIpcError } from "../lib/ipcError";
import { scrollbar } from "../lib/scrollbar";
import Markdown from "./Markdown";

interface Props {
  pr: PullRequest;
  onCollapse(): void;
  // Set by "Ask about this" on a claim. Without a question it attaches the
  // claim to the composer as a chip; with one (a suggested question) it sends
  // straight away. Owned by ReviewPanel so detail panes can set it.
  askRequest: AskRequest | null;
  onClearAskRequest(): void;
}

type UiMessage = ChatMessage & { id: string; failed?: boolean };

export default function ChatPanel({
  pr,
  onCollapse,
  askRequest,
  onClearAskRequest,
}: Props) {
  // Persisted history from the main process is the base; `local` overlays it
  // once the user starts talking (it also holds streaming + failed messages).
  const [local, setLocal] = useState<UiMessage[] | null>(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const streamingIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const handledRequestRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  const attachedContext = askRequest?.question
    ? null
    : (askRequest?.context ?? null);

  useEffect(() => {
    if (attachedContext) inputRef.current?.focus();
  }, [attachedContext]);

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

  // A suggested question from the split button's menu — send it as soon as
  // the chat is free (a streaming answer just queues it). The ref stops
  // re-renders from sending the same request twice.
  // biome-ignore lint/correctness/useExhaustiveDependencies: send/onClearAskRequest are recreated every render
  useEffect(() => {
    if (!askRequest?.question || busy) return;
    if (handledRequestRef.current === askRequest.id) return;
    handledRequestRef.current = askRequest.id;
    onClearAskRequest();
    void send(
      buildQuestionWithContext(askRequest.context, askRequest.question),
    );
  }, [askRequest, busy]);

  function ask() {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    const context = attachedContext;
    setQuestion("");
    onClearAskRequest();
    void send(context ? buildQuestionWithContext(context, trimmed) : trimmed);
  }

  async function send(fullQuestion: string) {
    setBusy(true);

    const answerId = crypto.randomUUID();
    streamingIdRef.current = answerId;
    setLocal([
      ...messages,
      { id: crypto.randomUUID(), role: "user", content: fullQuestion },
      { id: answerId, role: "assistant", content: "" },
    ]);

    try {
      const answer = await window.api.askQuestion(
        pr.repo,
        pr.number,
        fullQuestion,
      );
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
              <UserBubble key={message.id} content={message.content} />
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
        {attachedContext && (
          <HStack
            mb="2"
            gap="1.5"
            borderWidth="1px"
            rounded="md"
            px="2"
            py="1"
            bg="bg.subtle"
            fontSize="xs"
            color="fg.muted"
          >
            <LuMessageCircleQuestion size={12} />
            <Text truncate title={attachedContext.title}>
              About the {attachedContext.label}: {attachedContext.title}
            </Text>
            <IconButton
              aria-label="Remove attached context"
              size="2xs"
              variant="ghost"
              color="fg.muted"
              ml="auto"
              onClick={onClearAskRequest}
            >
              <LuX />
            </IconButton>
          </HStack>
        )}
        <Textarea
          ref={inputRef}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              ask();
            }
            if (event.key === "Escape" && attachedContext) {
              onClearAskRequest();
            }
          }}
          placeholder={
            busy
              ? "Answering…"
              : attachedContext
                ? `Ask about this ${attachedContext.label}…`
                : "Ask about this PR…"
          }
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

// User messages may carry an attached claim (see lib/askContext.ts) — show it
// as a compact tag above the typed question instead of the raw context block.
function UserBubble({ content }: { content: string }) {
  const parsed = parseQuestion(content);
  return (
    <Box
      alignSelf="flex-end"
      maxW="90%"
      bg="bg.emphasized"
      rounded="lg"
      px="3"
      py="2"
    >
      {parsed.context && (
        <HStack gap="1" fontSize="xs" color="fg.muted" mb="1">
          <LuMessageCircleQuestion size={12} />
          <Text truncate>
            About the {parsed.context.label}: {parsed.context.title}
          </Text>
        </HStack>
      )}
      <Text fontSize="sm">{parsed.question}</Text>
    </Box>
  );
}
