import { Box, HStack, Text } from "@chakra-ui/react";
import type { PullRequestComment } from "../../../shared/types";
import Markdown from "./Markdown";
import RelativeTime from "./RelativeTime";
import UserAvatar from "./UserAvatar";

interface Props {
  comment: PullRequestComment;
}

export default function CommentCard({ comment }: Props) {
  return (
    <Box borderWidth="1px" rounded="lg" overflow="hidden">
      <HStack gap="2" px="4" py="2.5" bg="bg.subtle" borderBottomWidth="1px">
        <UserAvatar username={comment.author} />
        <Text fontSize="sm" fontWeight="medium">
          {comment.author}
        </Text>
        <RelativeTime iso={comment.createdAt} fontSize="xs" color="fg.subtle" />
      </HStack>
      <Box px="4" py="3">
        {comment.body.trim() ? (
          <Markdown>{comment.body}</Markdown>
        ) : (
          <Text fontSize="sm" color="fg.muted" fontStyle="italic">
            No comment text.
          </Text>
        )}
      </Box>
    </Box>
  );
}
