import { Avatar } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface Props {
  username: string;
  boxSize?: string;
  // Shown while the image hasn't loaded (or can't) — instead of initials.
  fallback?: ReactNode;
  // "rounded" for organisations, GitHub-style; people stay circular.
  shape?: "full" | "rounded";
}

export default function UserAvatar({
  username,
  boxSize = "4",
  fallback,
  shape = "full",
}: Props) {
  return (
    <Avatar.Root boxSize={boxSize} size="2xs" shape={shape} flexShrink="0">
      <Avatar.Fallback
        name={fallback ? undefined : username}
        fontSize={fallback ? "10px" : "8px"}
        color={fallback ? "fg.muted" : undefined}
      >
        {fallback}
      </Avatar.Fallback>
      <Avatar.Image
        src={`https://avatars.githubusercontent.com/${username}?size=64`}
        alt={username}
      />
    </Avatar.Root>
  );
}
