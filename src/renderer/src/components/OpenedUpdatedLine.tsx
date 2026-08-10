import { HStack, Text } from "@chakra-ui/react";
import RelativeTime from "./RelativeTime";

interface Props {
  createdAt: string;
  updatedAt: string;
}

// The dates that close out a reading panel, on pull requests and issues alike.
export default function OpenedUpdatedLine({ createdAt, updatedAt }: Props) {
  return (
    <HStack fontSize="xs" color="fg.subtle" gap="4" flexWrap="wrap">
      <Text>
        Opened <RelativeTime iso={createdAt} />
      </Text>
      <Text>
        Updated <RelativeTime iso={updatedAt} />
      </Text>
    </HStack>
  );
}
