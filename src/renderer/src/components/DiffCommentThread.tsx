import { Box, Button, HStack, Text, Textarea, VStack } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ReviewComment } from "../../../shared/types";
import { formatDate } from "../lib/formatDate";
import type { ReviewThread } from "../lib/reviewComments";
import Markdown from "./Markdown";
import UserAvatar from "./UserAvatar";
import { toaster } from "./ui/toaster";

interface Props {
  thread: ReviewThread;
  repo: string;
  prNumber: number;
}

export default function DiffCommentThread({ thread, repo, prNumber }: Props) {
  const queryClient = useQueryClient();
  const [replying, setReplying] = useState(false);
  const [body, setBody] = useState("");

  const reply = useMutation({
    mutationFn: () =>
      window.api.replyToReviewComment(
        repo,
        prNumber,
        thread.root.id,
        body.trim(),
      ),
    onSuccess: (comment) => {
      queryClient.setQueryData<ReviewComment[]>(
        ["reviewComments", repo, prNumber],
        (existing) => [...(existing ?? []), comment],
      );
      setBody("");
      setReplying(false);
    },
    onError: (cause) => {
      toaster.create({
        type: "error",
        title: "Couldn’t reply",
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
    },
  });

  const canReply = body.trim().length > 0 && !reply.isPending;

  function handleKeyDown(event: React.KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canReply) {
      reply.mutate();
    }
    if (event.key === "Escape") cancelReply();
  }

  function cancelReply() {
    setReplying(false);
    setBody("");
  }

  return (
    <Box borderWidth="1px" rounded="lg" overflow="hidden" bg="bg.panel">
      {[thread.root, ...thread.replies].map((comment, index) => (
        <Box
          key={comment.id}
          px="3"
          py="2.5"
          borderTopWidth={index > 0 ? "1px" : undefined}
        >
          <HStack gap="2" mb="1.5">
            <UserAvatar username={comment.author} />
            <Text fontSize="sm" fontWeight="medium">
              {comment.author}
            </Text>
            <Text fontSize="xs" color="fg.subtle">
              {formatDate(comment.createdAt)}
            </Text>
          </HStack>
          {comment.body.trim() ? (
            <Markdown>{comment.body}</Markdown>
          ) : (
            <Text fontSize="sm" color="fg.muted" fontStyle="italic">
              No comment text.
            </Text>
          )}
        </Box>
      ))}
      <Box borderTopWidth="1px" px="2" py="1.5" bg="bg.subtle">
        {replying ? (
          <VStack alignItems="stretch" gap="2" p="1">
            <Textarea
              autoFocus
              placeholder="Reply (markdown supported)"
              rows={2}
              resize="vertical"
              bg="bg.panel"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <HStack justifyContent="flex-end" gap="2">
              <Button size="xs" variant="ghost" onClick={cancelReply}>
                Cancel
              </Button>
              <Button
                size="xs"
                disabled={!canReply}
                loading={reply.isPending}
                onClick={() => reply.mutate()}
              >
                Reply
              </Button>
            </HStack>
          </VStack>
        ) : (
          <Button
            size="xs"
            variant="ghost"
            color="fg.muted"
            w="full"
            justifyContent="flex-start"
            onClick={() => setReplying(true)}
          >
            Reply…
          </Button>
        )}
      </Box>
    </Box>
  );
}
