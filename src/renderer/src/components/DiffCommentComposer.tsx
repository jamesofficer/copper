import { Box, Button, HStack, Text, Textarea } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LuSparkles } from "react-icons/lu";
import type {
  DiffSide,
  DraftReviewComment,
  Explanation,
  ReviewComment,
} from "../../../shared/types";
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
  // The selected lines' text — sent to the agent by the "Explain" action.
  code: string;
  // True once any draft exists on the PR — a review is in progress, so the
  // single-comment escape hatch is hidden (GitHub does the same).
  reviewStarted: boolean;
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
  code,
  reviewStarted,
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  function newComment() {
    return { commitId, path, side, line, startLine, body: body.trim() };
  }

  // Posts to GitHub immediately, outside any review.
  const submit = useMutation({
    mutationFn: () => window.api.addReviewComment(repo, prNumber, newComment()),
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

  // Saves a local draft — submitted later as part of the batch review.
  const saveDraft = useMutation({
    mutationFn: () => window.api.addDraftComment(repo, prNumber, newComment()),
    onSuccess: (created) => {
      queryClient.setQueryData<DraftReviewComment[]>(
        ["draftComments", repo, prNumber],
        (existing) => [...(existing ?? []), created],
      );
      onClose();
    },
    onError: (cause) => {
      toaster.create({
        type: "error",
        title: "Couldn’t save draft comment",
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
    },
  });

  // Asks the agent to explain the selected lines — a local-only card, never
  // posted to GitHub. Ignores the comment textarea.
  const explain = useMutation({
    mutationFn: () =>
      window.api.explainSelection(repo, prNumber, {
        path,
        side,
        line,
        startLine,
        code,
      }),
    onSuccess: (created) => {
      queryClient.setQueryData<Explanation[]>(
        ["explanations", repo, prNumber],
        (existing) => [...(existing ?? []), created],
      );
      onClose();
    },
    onError: (cause) => {
      toaster.create({
        type: "error",
        title: "Couldn’t explain selection",
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
    },
  });

  const busy = submit.isPending || saveDraft.isPending || explain.isPending;
  const canSubmit = body.trim().length > 0 && !busy;

  function handleKeyDown(event: React.KeyboardEvent) {
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key === "Enter" &&
      canSubmit
    ) {
      saveDraft.mutate();
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
      <HStack gap="2" px="3" py="2" borderTopWidth="1px">
        <Button
          size="xs"
          variant="ghost"
          color="colorPalette.fg"
          disabled={busy}
          loading={explain.isPending}
          onClick={() => explain.mutate()}
          title="Ask the AI to explain the selected lines"
        >
          <LuSparkles /> Explain
        </Button>
        <Button size="xs" variant="ghost" ml="auto" onClick={onClose}>
          Cancel
        </Button>
        {!reviewStarted && (
          <Button
            size="xs"
            variant="outline"
            disabled={!canSubmit}
            loading={submit.isPending}
            onClick={() => submit.mutate()}
          >
            Add single comment
          </Button>
        )}
        <Button
          size="xs"
          disabled={!canSubmit}
          loading={saveDraft.isPending}
          onClick={() => saveDraft.mutate()}
        >
          {reviewStarted ? "Add review comment" : "Start a review"}
        </Button>
      </HStack>
    </Box>
  );
}
