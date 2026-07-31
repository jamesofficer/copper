import { Badge, Button, HStack } from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SettingRow } from "./SettingsLayout";

// A GitHub session is separate from the personal access token above, and only
// attachments need it: GitHub's upload endpoint refuses tokens and accepts a
// browser session cookie alone.
export default function GitHubSessionSettings() {
  const queryClient = useQueryClient();
  const { data: status } = useQuery({
    queryKey: ["attachmentAuth"],
    queryFn: () => window.api.getAttachmentAuthStatus(),
  });

  const change = useMutation({
    mutationFn: (action: "in" | "out") =>
      action === "in"
        ? window.api.signInForAttachments()
        : window.api.signOutOfAttachments(),
    onSuccess: (next) => queryClient.setQueryData(["attachmentAuth"], next),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["attachmentAuth"] }),
  });

  const signedIn = status?.signedIn ?? false;

  return (
    <SettingRow
      title="GitHub session (for attachments)"
      description="Needed to attach images and videos to descriptions and comments. GitHub has no API for uploads, so the app signs in to github.com in its own window and lets GitHub handle the upload."
    >
      <HStack gap="3">
        {signedIn ? (
          <Badge colorPalette="green" variant="subtle">
            {status?.login ? `Connected as ${status.login}` : "Connected"}
          </Badge>
        ) : (
          <Badge variant="subtle">Not connected</Badge>
        )}
        <Button
          size="xs"
          variant="outline"
          loading={change.isPending}
          onClick={() => change.mutate(signedIn ? "out" : "in")}
        >
          {signedIn ? "Disconnect" : "Connect"}
        </Button>
      </HStack>
    </SettingRow>
  );
}
