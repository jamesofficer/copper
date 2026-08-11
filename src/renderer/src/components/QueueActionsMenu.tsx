import { IconButton, Menu, Portal } from "@chakra-ui/react";
import {
  LuEllipsis,
  LuExternalLink,
  LuFolderPlus,
  LuSettings,
} from "react-icons/lu";

interface Props {
  // The active repo's owner/name, when it has a GitHub remote.
  repoSlug?: string;
  onAddRepo(): void;
  onOpenSettings(): void;
}

// The review queue's overflow menu: the things a reviewer needs now and then,
// kept out of a header too narrow to hold them as buttons. Settings is here as
// well as in the sidebar footer, since the sidebar can be hidden.
export default function QueueActionsMenu({
  repoSlug,
  onAddRepo,
  onOpenSettings,
}: Props) {
  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <IconButton
          aria-label="More actions"
          title="More actions"
          variant="ghost"
          size="xs"
          color="fg.muted"
        >
          <LuEllipsis />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="52">
            {repoSlug && (
              <Menu.Item value="github" asChild>
                <a
                  href={`https://github.com/${repoSlug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <LuExternalLink /> Open repository on GitHub
                </a>
              </Menu.Item>
            )}
            <Menu.Item value="add-repo" onClick={onAddRepo}>
              <LuFolderPlus /> Add repository…
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item value="settings" onClick={onOpenSettings}>
              <LuSettings /> Settings…
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
