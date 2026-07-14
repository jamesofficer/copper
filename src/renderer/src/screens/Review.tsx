import {
  Badge,
  Box,
  Button,
  Center,
  Flex,
  Grid,
  Heading,
  HStack,
  Input,
  Spinner,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { LuArrowLeft } from "react-icons/lu";
import type {
  AnalysisResult,
  ChatMessage,
  PullRequest,
  Risk,
} from "../../../shared/types";

interface Props {
  pr: PullRequest;
  onBack(): void;
}

const riskColor: Record<Risk, string> = {
  low: "green",
  medium: "yellow",
  high: "red",
};

export default function Review({ pr, onBack }: Props) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [messages, setMessages] = useState<Array<ChatMessage & { id: string }>>(
    [],
  );
  const [question, setQuestion] = useState("");

  useEffect(() => {
    void window.api.openPullRequest(pr.repo, pr.number).then(setAnalysis);
  }, [pr.repo, pr.number]);

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
    <Flex direction="column" h="100vh">
      <HStack gap="3" px="4" py="3" borderBottomWidth="1px" flexShrink="0">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <LuArrowLeft /> Back
        </Button>
        <Heading size="md" truncate>
          {pr.title}
        </Heading>
        <Text fontFamily="mono" fontSize="sm" color="fg.muted">
          {pr.repo}#{pr.number}
        </Text>
      </HStack>

      <Grid templateColumns="300px 1fr 340px" flex="1" minH="0">
        <Stack gap="3" p="4" overflowY="auto" borderRightWidth="1px">
          <Heading
            size="xs"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Changes
          </Heading>
          {analysis === null ? (
            <HStack color="fg.muted">
              <Spinner size="sm" />
              <Text fontSize="sm">Analyzing…</Text>
            </HStack>
          ) : (
            analysis.readingOrder.map((groupId) => {
              const group = analysis.groups.find(
                (candidate) => candidate.id === groupId,
              );
              if (!group) return null;
              return (
                <Box
                  key={group.id}
                  borderWidth="1px"
                  borderLeftWidth="3px"
                  borderLeftColor={`${riskColor[group.risk]}.solid`}
                  rounded="md"
                  p="3"
                >
                  <HStack justifyContent="space-between" mb="1">
                    <Text fontWeight="semibold" fontSize="sm">
                      {group.title}
                    </Text>
                    <Badge
                      colorPalette={riskColor[group.risk]}
                      variant="surface"
                      size="xs"
                    >
                      {group.risk}
                    </Badge>
                  </HStack>
                  <Text fontSize="sm" color="fg.muted" mb="2">
                    {group.why}
                  </Text>
                  <Stack gap="0.5">
                    {group.files.map((file) => (
                      <Text
                        key={file}
                        fontFamily="mono"
                        fontSize="xs"
                        color="fg.subtle"
                        truncate
                      >
                        {file}
                      </Text>
                    ))}
                  </Stack>
                </Box>
              );
            })
          )}
        </Stack>

        <Center p="4">
          <Text color="fg.muted" fontSize="sm">
            Diff viewer goes here.
          </Text>
        </Center>

        <Flex direction="column" gap="6" p="4" borderLeftWidth="1px" minH="0">
          <Box>
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
              {analysis?.summaries?.overview ?? "Generating…"}
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
      </Grid>
    </Flex>
  );
}
