import { Box, Button, HStack, Text, Textarea } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { PullRequest, PullRequestComment } from "../../../shared/types";
import Markdown from "./Markdown";
import { toaster } from "./ui/toaster";

interface Props {
  pr: PullRequest;
}

type Mode = "write" | "preview";

export default function CommentComposer({ pr }: Props) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<Mode>("write");

  const submit = useMutation({
    mutationFn: () =>
      window.api.addPullRequestComment(pr.repo, pr.number, body.trim()),
    onSuccess: (comment) => {
      queryClient.setQueryData<PullRequestComment[]>(
        ["pullRequestComments", pr.repo, pr.number],
        (existing) => [...(existing ?? []), comment],
      );
      setBody("");
      setMode("write");
    },
    onError: (cause) => {
      toaster.create({
        type: "error",
        title: "Couldn’t add comment",
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
    },
  });

  const canSubmit = body.trim().length > 0 && !submit.isPending;

  function handleKeyDown(event: React.KeyboardEvent) {
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key === "Enter" &&
      canSubmit
    ) {
      submit.mutate();
    }
  }

  return (
    <Box borderWidth="1px" rounded="lg" overflow="hidden">
      <HStack gap="1" px="2" py="1.5" bg="bg.subtle" borderBottomWidth="1px">
        <ModeButton
          active={mode === "write"}
          onClick={() => setMode("write")}
          label="Write"
        />
        <ModeButton
          active={mode === "preview"}
          onClick={() => setMode("preview")}
          label="Preview"
        />
      </HStack>
      {mode === "write" ? (
        <Textarea
          placeholder="Add a comment (markdown supported)"
          rows={4}
          resize="vertical"
          border="none"
          rounded="none"
          _focus={{ outline: "none", boxShadow: "none" }}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <Box px="4" py="3" minH="102px">
          {body.trim() ? (
            <Markdown>{body}</Markdown>
          ) : (
            <Text fontSize="sm" color="fg.muted" fontStyle="italic">
              Nothing to preview.
            </Text>
          )}
        </Box>
      )}
      <HStack justifyContent="flex-end" px="3" py="2" borderTopWidth="1px">
        <Button
          size="xs"
          disabled={!canSubmit}
          loading={submit.isPending}
          onClick={() => submit.mutate()}
        >
          Comment
        </Button>
      </HStack>
    </Box>
  );
}

interface ModeButtonProps {
  active: boolean;
  onClick(): void;
  label: string;
}

function ModeButton({ active, onClick, label }: ModeButtonProps) {
  return (
    <Button
      size="2xs"
      variant={active ? "surface" : "ghost"}
      color={active ? "fg" : "fg.muted"}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
