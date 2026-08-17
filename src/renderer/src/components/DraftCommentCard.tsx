import { Badge, Box, Button, HStack, IconButton, Text } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LuPencil, LuTrash2 } from "react-icons/lu";
import type { DraftReviewComment } from "../../../shared/types";
import Markdown from "./Markdown";
import MarkdownEditor, { type MarkdownEditorMode } from "./MarkdownEditor";
import { toaster } from "./ui/toaster";

interface Props {
  draft: DraftReviewComment;
  repo: string;
  prNumber: number;
}

// A locally drafted review comment under its diff line — freely editable and
// deletable, since nothing reaches GitHub until the review is submitted.
export default function DraftCommentCard({ draft, repo, prNumber }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body);
  const [mode, setMode] = useState<MarkdownEditorMode>("write");
  const [confirming, setConfirming] = useState(false);

  const draftsKey = ["draftComments", repo, prNumber];

  const update = useMutation({
    mutationFn: () =>
      window.api.updateDraftComment(repo, prNumber, draft.id, body.trim()),
    onSuccess: (updated) => {
      queryClient.setQueryData<DraftReviewComment[]>(draftsKey, (existing) =>
        (existing ?? []).map((entry) =>
          entry.id === updated.id ? updated : entry,
        ),
      );
      setEditing(false);
      setMode("write");
    },
    onError: (cause) => {
      toaster.create({
        type: "error",
        title: "Couldn’t update draft",
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
    },
  });

  const remove = useMutation({
    mutationFn: () => window.api.deleteDraftComment(repo, prNumber, draft.id),
    onSuccess: () => {
      queryClient.setQueryData<DraftReviewComment[]>(draftsKey, (existing) =>
        (existing ?? []).filter((entry) => entry.id !== draft.id),
      );
    },
    onError: (cause) => {
      setConfirming(false);
      toaster.create({
        type: "error",
        title: "Couldn’t delete draft",
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
    },
  });

  const canSave = body.trim().length > 0 && !update.isPending;

  function startEdit() {
    setBody(draft.body);
    setMode("write");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setBody(draft.body);
    setMode("write");
  }

  return (
    <Box borderWidth="1px" rounded="lg" overflow="hidden" bg="bg.panel">
      <HStack gap="2" px="3" py="2" bg="bg.subtle" borderBottomWidth="1px">
        <Badge colorPalette="yellow" variant="surface" size="sm">
          Pending
        </Badge>
        <Text fontSize="xs" color="fg.muted">
          Part of your unsubmitted review
        </Text>
        {confirming ? (
          <HStack gap="1" ml="auto">
            <Button
              size="2xs"
              colorPalette="red"
              loading={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Delete
            </Button>
            <Button
              size="2xs"
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </HStack>
        ) : (
          <HStack gap="1" ml="auto">
            <IconButton
              size="2xs"
              variant="ghost"
              color="fg.muted"
              aria-label="Edit draft comment"
              onClick={startEdit}
            >
              <LuPencil />
            </IconButton>
            <IconButton
              size="2xs"
              variant="ghost"
              color="fg.muted"
              aria-label="Delete draft comment"
              onClick={() => setConfirming(true)}
            >
              <LuTrash2 />
            </IconButton>
          </HStack>
        )}
      </HStack>
      {editing ? (
        <Box p="2">
          <MarkdownEditor
            autoFocus
            value={body}
            mode={mode}
            placeholder="Leave a comment (markdown supported)"
            rows={3}
            onChange={setBody}
            onModeChange={setMode}
            onSubmit={() => canSave && update.mutate()}
            onEscape={cancelEdit}
            attachments={{ repo, prNumber }}
            footer={
              <>
                <Button size="xs" variant="ghost" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button
                  size="xs"
                  disabled={!canSave}
                  loading={update.isPending}
                  onClick={() => update.mutate()}
                >
                  Save
                </Button>
              </>
            }
          />
        </Box>
      ) : (
        <Box px="3" py="2.5">
          <Markdown>{draft.body}</Markdown>
        </Box>
      )}
    </Box>
  );
}
