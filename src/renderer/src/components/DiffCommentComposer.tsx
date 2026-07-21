import { Box, Button, HStack, Text, Textarea } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { DiffSide, ReviewComment } from "../../../shared/types";
import { toaster } from "./ui/toaster";

interface Props {
  repo: string;
  prNumber: number;
  commitId: string;
  path: string;
  side: DiffSide;
  line: number;
  // Set when the comment covers a range ending at `line`.
  startLine: number | null;
  onClose(): void;
}

export default function DiffCommentComposer({
  repo,
  prNumber,
  commitId,
  path,
  side,
  line,
  startLine,
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      window.api.addReviewComment(repo, prNumber, {
        commitId,
        path,
        side,
        line,
        startLine,
        body: body.trim(),
      }),
    onSuccess: (comment) => {
      queryClient.setQueryData<ReviewComment[]>(
        ["reviewComments", repo, prNumber],
        (existing) => [...(existing ?? []), comment],
      );
      onClose();
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
    if (event.key === "Escape") onClose();
  }

  const lineLabel =
    startLine !== null ? `lines ${startLine}–${line}` : `line ${line}`;

  return (
    <Box borderWidth="1px" rounded="lg" overflow="hidden" bg="bg.panel">
      <Box px="3" py="2" bg="bg.subtle" borderBottomWidth="1px">
        <Text fontSize="xs" color="fg.muted">
          Commenting on {lineLabel}
          {side === "LEFT" ? " of the old version" : ""}
        </Text>
      </Box>
      <Textarea
        autoFocus
        placeholder="Leave a comment (markdown supported)"
        rows={3}
        resize="vertical"
        border="none"
        rounded="none"
        _focus={{ outline: "none", boxShadow: "none" }}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <HStack
        justifyContent="flex-end"
        gap="2"
        px="3"
        py="2"
        borderTopWidth="1px"
      >
        <Button size="xs" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
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
