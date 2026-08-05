import { Button, CloseButton, Dialog, Portal, Text } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toaster } from "./ui/toaster";

interface Props {
  // The checkout the paths belong to.
  repoPath: string;
  // The paths awaiting confirmation; null keeps the dialog closed.
  paths: string[] | null;
  // Which of those git doesn't track — deleted, not reverted.
  untracked: Set<string>;
  onClose(): void;
}

function fileName(path: string): string {
  return path.split("/").pop() ?? path;
}

// The one irreversible action in the app: git keeps no record of discarded
// work, and an untracked file is deleted outright rather than reverted. Hence
// a real dialog instead of the inline confirm step used for things a re-run
// can recover, and wording that names which of the two is about to happen.
export default function DiscardChangesDialog({
  repoPath,
  paths,
  untracked,
  onClose,
}: Props) {
  const queryClient = useQueryClient();

  const discard = useMutation({
    mutationFn: (targets: string[]) =>
      window.api.discardChanges(repoPath, targets),
    onError: (error) => {
      toaster.create({
        type: "error",
        title: "Couldn't discard",
        description: error instanceof Error ? error.message : String(error),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["localChanges", repoPath] });
      onClose();
    },
  });

  const targets = paths ?? [];
  const deleted = targets.filter((path) => untracked.has(path));
  const reverted = targets.length - deleted.length;
  const onlyDeletes = deleted.length === targets.length && targets.length > 0;

  return (
    <Dialog.Root
      open={paths !== null}
      onOpenChange={(event) => {
        if (!event.open && !discard.isPending) onClose();
      }}
      role="alertdialog"
      size="sm"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>
                {onlyDeletes
                  ? targets.length === 1
                    ? "Delete this file?"
                    : `Delete ${targets.length} files?`
                  : targets.length === 1
                    ? "Discard these changes?"
                    : `Discard changes to ${targets.length} files?`}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
            <Dialog.Body>
              {targets.length === 1 && (
                <Text fontFamily="mono" fontSize="sm" mb="2" truncate>
                  {fileName(targets[0])}
                </Text>
              )}
              <Text fontSize="sm" color="fg.muted">
                {onlyDeletes
                  ? "Git doesn't track it yet, so deleting it is permanent — there is no version to restore."
                  : deleted.length > 0
                    ? `${reverted} file${reverted === 1 ? "" : "s"} revert to their staged state, and ${deleted.length} untracked file${deleted.length === 1 ? " is" : "s are"} deleted permanently.`
                    : "The unstaged edits are lost. Anything already staged is kept. This can't be undone."}
              </Text>
            </Dialog.Body>
            <Dialog.Footer gap="2">
              <Button
                size="sm"
                variant="outline"
                disabled={discard.isPending}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                colorPalette="red"
                loading={discard.isPending}
                onClick={() => discard.mutate(targets)}
              >
                {onlyDeletes ? "Delete" : "Discard"}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
