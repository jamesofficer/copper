import { Avatar } from "@chakra-ui/react";

interface Props {
  username: string;
  boxSize?: string;
}

export default function UserAvatar({ username, boxSize = "4" }: Props) {
  return (
    <Avatar.Root boxSize={boxSize} size="2xs" flexShrink="0">
      <Avatar.Fallback name={username} fontSize="8px" />
      <Avatar.Image
        src={`https://avatars.githubusercontent.com/${username}?size=64`}
        alt={username}
      />
    </Avatar.Root>
  );
}
