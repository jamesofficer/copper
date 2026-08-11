import { HStack, Text, VStack } from "@chakra-ui/react";
import UserAvatar from "./UserAvatar";

interface Props {
  logins: string[];
  // What to say when the list is empty. A rail section that vanishes reads as
  // a panel that failed to load, so every one of them answers its own heading.
  empty: string;
}

// A rail list of GitHub logins — assignees today. Both rails had their own copy
// of this, which is how the pull request's Assignees section came to hide
// itself when empty while the issue's said "Nobody assigned".
export default function UserList({ logins, empty }: Props) {
  if (logins.length === 0) {
    return (
      <Text fontSize="sm" color="fg.muted">
        {empty}
      </Text>
    );
  }

  return (
    <VStack gap="2" alignItems="stretch">
      {logins.map((login) => (
        <HStack key={login} gap="2">
          <UserAvatar username={login} />
          <Text fontFamily="mono" fontSize="sm" truncate>
            {login}
          </Text>
        </HStack>
      ))}
    </VStack>
  );
}
