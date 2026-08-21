import { Box, Button, HStack, Stack, Textarea } from "@chakra-ui/react";
import { useState } from "react";
import { LuGitCommitHorizontal, LuUpload } from "react-icons/lu";
import { useLocalCommitActions } from "../../lib/useLocalCommitActions";

interface Props {
  // The checkout to commit in — the registered repo path, or a worktree.
  path: string;
  branch?: string;
  stagedCount: number;
  // Set while a past commit is being read: the box stays in place, greyed out,
  // rather than unmounting and shifting the panels above it.
  disabled?: boolean;
}

// Commits the index of one checkout. Staging is the only way changes reach a
// commit here — there is no "commit all", deliberately: the file list above
// is the record of what is about to be committed.
export default function CommitComposer({
  path,
  branch,
  stagedCount,
  disabled,
}: Props) {
  const [message, setMessage] = useState("");

  function clearMessage(): void {
    setMessage("");
  }

  const actions = useLocalCommitActions({
    path,
    message,
    onCommitted: clearMessage,
  });

  const ready =
    !disabled &&
    stagedCount > 0 &&
    message.trim() !== "" &&
    !actions.writesPending;

  return (
    <Stack gap="2" px="3" py="3" borderTopWidth="1px" flexShrink="0">
      <Textarea
        size="xs"
        rows={3}
        resize="none"
        disabled={disabled}
        placeholder={
          disabled
            ? "Reading a past commit"
            : stagedCount > 0
              ? "Commit message"
              : "Stage a file to commit"
        }
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            if (ready && !actions.commitPending) actions.commit();
          }
        }}
      />
      <HStack gap="2">
        <Button
          size="xs"
          flex="1"
          disabled={!ready}
          loading={actions.commitPending}
          onClick={actions.commit}
        >
          <Box asChild>
            <LuGitCommitHorizontal />
          </Box>
          {!disabled && stagedCount > 0
            ? `Commit ${stagedCount} file${stagedCount === 1 ? "" : "s"}`
            : "Commit"}
        </Button>
        <Button
          size="xs"
          variant="outline"
          disabled={!branch || actions.writesPending}
          loading={actions.pushPending}
          title={branch ? `Push ${branch}` : "Check out a branch to push"}
          onClick={actions.push}
        >
          <Box asChild>
            <LuUpload />
          </Box>
          Push
        </Button>
      </HStack>
    </Stack>
  );
}
