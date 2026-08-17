import { Box, Button, HStack, IconButton, Text } from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LuTrash2 } from "react-icons/lu";
import type { ReviewComment } from "../../../shared/types";
import type { ReviewThread } from "../lib/reviewComments";
import Markdown from "./Markdown";
import MarkdownEditor, { type MarkdownEditorMode } from "./MarkdownEditor";
import ReactionBar from "./ReactionBar";
import RelativeTime from "./RelativeTime";
import UserAvatar from "./UserAvatar";
import { toaster } from "./ui/toaster";

interface Props {
  thread: ReviewThread;
  repo: string;
  prNumber: number;
  // Current resolution state — undefined when the caller doesn't know it,
  // which also hides the resolve button.
  resolved?: boolean;
}

export default function DiffCommentThread({
  thread,
  repo,
  prNumber,
  resolved,
}: Props) {
  const queryClient = useQueryClient();
  const [replying, setReplying] = useState(false);
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<MarkdownEditorMode>("write");
  // The comment whose delete button is waiting for confirmation.
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  // GitHub only lets you delete your own comments, so the button is offered
  // on those alone.
  const viewerQuery = useQuery({
    queryKey: ["viewer"],
    queryFn: () => window.api.getViewer(),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const viewer = viewerQuery.data;

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
      setMode("write");
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

  const remove = useMutation({
    mutationFn: (commentId: number) =>
      window.api.deleteReviewComment(repo, commentId),
    // Refetch instead of editing the cache: deleting a thread's opening
    // comment re-roots its replies, which only the server knows about.
    onSuccess: () => {
      setConfirmingId(null);
      queryClient.invalidateQueries({
        queryKey: ["reviewComments", repo, prNumber],
      });
    },
    onError: (cause) => {
      setConfirmingId(null);
      toaster.create({
        type: "error",
        title: "Couldn’t delete comment",
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
    },
  });

  const resolve = useMutation({
    mutationFn: () =>
      window.api.setReviewThreadResolved(
        repo,
        prNumber,
        thread.root.id,
        !resolved,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["resolvedThreads", repo, prNumber],
      });
    },
    onError: (cause) => {
      toaster.create({
        type: "error",
        title: resolved ? "Couldn’t unresolve" : "Couldn’t resolve",
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
    },
  });

  const canReply = body.trim().length > 0 && !reply.isPending;

  function cancelReply() {
    setReplying(false);
    setBody("");
    setMode("write");
  }

  return (
    <Box borderWidth="1px" rounded="lg" overflow="hidden" bg="bg.panel">
      {[thread.root, ...thread.replies].map((comment, index) => (
        <Box
          key={comment.id}
          className="group"
          px="3"
          py="2.5"
          borderTopWidth={index > 0 ? "1px" : undefined}
        >
          <HStack gap="2" mb="1.5">
            <UserAvatar username={comment.author} />
            <Text fontSize="sm" fontWeight="medium">
              {comment.author}
            </Text>
            <RelativeTime
              iso={comment.createdAt}
              fontSize="xs"
              color="fg.subtle"
            />
            {viewer === comment.author &&
              (confirmingId === comment.id ? (
                <HStack gap="1" ml="auto">
                  <Button
                    size="2xs"
                    colorPalette="red"
                    loading={remove.isPending}
                    onClick={() => remove.mutate(comment.id)}
                  >
                    Delete
                  </Button>
                  <Button
                    size="2xs"
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={() => setConfirmingId(null)}
                  >
                    Cancel
                  </Button>
                </HStack>
              ) : (
                <IconButton
                  size="2xs"
                  variant="ghost"
                  color="fg.muted"
                  aria-label="Delete comment"
                  ml="auto"
                  opacity="0"
                  _groupHover={{ opacity: 1 }}
                  _focusVisible={{ opacity: 1 }}
                  onClick={() => setConfirmingId(comment.id)}
                >
                  <LuTrash2 />
                </IconButton>
              ))}
          </HStack>
          {comment.body.trim() ? (
            <Markdown>{comment.body}</Markdown>
          ) : (
            <Text fontSize="sm" color="fg.muted" fontStyle="italic">
              No comment text.
            </Text>
          )}
          <ReactionBar
            repo={repo}
            prNumber={prNumber}
            commentId={comment.id}
            commentNodeId={comment.nodeId}
          />
        </Box>
      ))}
      <Box borderTopWidth="1px" px="2" py="1.5" bg="bg.subtle">
        {replying ? (
          <Box p="1">
            <MarkdownEditor
              autoFocus
              value={body}
              mode={mode}
              placeholder="Reply (markdown supported)"
              rows={2}
              onChange={setBody}
              onModeChange={setMode}
              onSubmit={() => canReply && reply.mutate()}
              onEscape={cancelReply}
              attachments={{ repo, prNumber }}
              footer={
                <>
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
                </>
              }
            />
          </Box>
        ) : (
          <HStack gap="1">
            <Button
              size="xs"
              variant="ghost"
              color="fg.muted"
              flex="1"
              justifyContent="flex-start"
              onClick={() => setReplying(true)}
            >
              Reply…
            </Button>
            {resolved !== undefined && (
              <Button
                size="xs"
                variant="ghost"
                color="fg.muted"
                flexShrink="0"
                loading={resolve.isPending}
                onClick={() => resolve.mutate()}
              >
                {resolved ? "Unresolve conversation" : "Resolve conversation"}
              </Button>
            )}
          </HStack>
        )}
      </Box>
    </Box>
  );
}
