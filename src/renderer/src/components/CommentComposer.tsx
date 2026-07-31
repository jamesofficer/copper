import { Button } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { PullRequest, PullRequestComment } from "../../../shared/types";
import MarkdownEditor, { type MarkdownEditorMode } from "./MarkdownEditor";
import { toaster } from "./ui/toaster";

interface Props {
  pr: PullRequest;
}

export default function CommentComposer({ pr }: Props) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<MarkdownEditorMode>("write");

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

  return (
    <MarkdownEditor
      value={body}
      mode={mode}
      placeholder="Add a comment (markdown supported)"
      onChange={setBody}
      onModeChange={setMode}
      onSubmit={() => canSubmit && submit.mutate()}
      attachments={{ repo: pr.repo, prNumber: pr.number }}
      footer={
        <Button
          size="xs"
          disabled={!canSubmit}
          loading={submit.isPending}
          onClick={() => submit.mutate()}
        >
          Comment
        </Button>
      }
    />
  );
}
