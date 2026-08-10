import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LuPencil } from "react-icons/lu";
import type { PullRequestDetail } from "../../../shared/types";
import Markdown from "./Markdown";
import MarkdownEditor, { type MarkdownEditorMode } from "./MarkdownEditor";
import SectionHeading from "./SectionHeading";
import { toaster } from "./ui/toaster";

interface Props {
  detail: PullRequestDetail;
  // Editing is only offered in the full review screen, not the home-screen
  // preview panel.
  editable?: boolean;
}

// The PR description, with an in-place markdown editor for people who can
// change it. GitHub allows the author and anyone with write access; rather
// than guess at permissions we offer it and let a rejected save surface as a
// toast, like the other in-place PR actions.
export default function PullRequestDescription({ detail, editable }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<MarkdownEditorMode>("write");

  const save = useMutation({
    mutationFn: () =>
      window.api.setPullRequestBody(detail.repo, detail.number, body),
    onSuccess: () => {
      setEditing(false);
      queryClient.setQueryData<PullRequestDetail>(
        ["pullRequest", detail.repo, detail.number],
        (current) => (current ? { ...current, body } : current),
      );
      void queryClient.invalidateQueries({
        queryKey: ["pullRequest", detail.repo, detail.number],
      });
      toaster.create({ type: "success", title: "Description updated" });
    },
    onError: (cause) => {
      toaster.create({
        type: "error",
        title: "Couldn’t update the description",
        description:
          cause instanceof Error
            ? cause.message.replace(/^.*Error: /, "")
            : String(cause),
        closable: true,
      });
    },
  });

  function startEditing() {
    setBody(detail.body ?? "");
    setMode("write");
    setEditing(true);
  }

  const canSave = body !== (detail.body ?? "") && !save.isPending;

  return (
    <Box>
      <HStack justifyContent="space-between" mb="3">
        <SectionHeading mb="0">Description</SectionHeading>
        {editable && !editing && (
          <Button size="2xs" variant="ghost" onClick={startEditing}>
            <LuPencil /> Edit
          </Button>
        )}
      </HStack>

      {editing ? (
        <MarkdownEditor
          value={body}
          mode={mode}
          placeholder="Describe the change (markdown supported)"
          rows={16}
          onChange={setBody}
          onModeChange={setMode}
          onSubmit={() => canSave && save.mutate()}
          attachments={{ repo: detail.repo, prNumber: detail.number }}
          footer={
            <>
              <Button
                size="xs"
                variant="ghost"
                disabled={save.isPending}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                disabled={!canSave}
                loading={save.isPending}
                onClick={() => save.mutate()}
              >
                Save
              </Button>
            </>
          }
        />
      ) : detail.body?.trim() ? (
        <Markdown>{detail.body}</Markdown>
      ) : (
        <Text fontSize="sm" color="fg.muted" fontStyle="italic">
          No description provided.
        </Text>
      )}
    </Box>
  );
}
