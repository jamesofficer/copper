import {
  Box,
  Button,
  Center,
  Flex,
  Grid,
  Heading,
  HStack,
  Input,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LuArrowLeft } from "react-icons/lu";
import type { ChatMessage, PullRequest } from "../../../shared/types";
import DiffView from "../components/DiffView";
import FileList from "../components/FileList";

interface Props {
  pr: PullRequest;
  onBack(): void;
}

export default function Review({ pr, onBack }: Props) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<ChatMessage & { id: string }>>(
    [],
  );
  const [question, setQuestion] = useState("");

  const filesQuery = useQuery({
    queryKey: ["pullRequestFiles", pr.repo, pr.number],
    queryFn: () => window.api.listPullRequestFiles(pr.repo, pr.number),
  });
  const files = filesQuery.data;
  const selectedFile =
    files?.find((file) => file.path === selectedPath) ?? files?.[0] ?? null;

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
        <Flex direction="column" borderRightWidth="1px" minH="0">
          <Heading
            size="xs"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="wider"
            px="4"
            py="3"
            flexShrink="0"
          >
            Files{files ? ` (${files.length})` : ""}
          </Heading>
          <Box flex="1" overflowY="auto" px="3" pb="3">
            {filesQuery.isPending ? (
              <HStack color="fg.muted" px="1">
                <Spinner size="sm" />
                <Text fontSize="sm">Loading changed files…</Text>
              </HStack>
            ) : filesQuery.isError ? (
              <Text fontSize="sm" color="fg.error" px="1">
                {filesQuery.error instanceof Error
                  ? filesQuery.error.message
                  : "Couldn't load changed files."}
              </Text>
            ) : files && files.length > 0 ? (
              <FileList
                files={files}
                selectedPath={selectedFile?.path ?? null}
                onSelect={setSelectedPath}
              />
            ) : (
              <Text fontSize="sm" color="fg.muted" px="1">
                No changed files.
              </Text>
            )}
          </Box>
        </Flex>

        <Box minH="0" minW="0">
          {selectedFile ? (
            <DiffView file={selectedFile} />
          ) : (
            <Center h="full" p="4">
              <Text color="fg.muted" fontSize="sm">
                {filesQuery.isPending
                  ? "Loading diff…"
                  : "Select a file to view its diff."}
              </Text>
            </Center>
          )}
        </Box>

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
