import { Box, HStack, Text } from "@chakra-ui/react";
import type { PullRequestComment } from "../../../shared/types";
import Markdown from "./Markdown";
import ReactionBar from "./ReactionBar";
import RelativeTime from "./RelativeTime";
import UserAvatar from "./UserAvatar";

interface Props {
  comment: PullRequestComment;
  repo: string;
  // The pull request or issue the comment belongs to. GitHub numbers both in
  // one sequence per repo, so this identifies either.
  number: number;
  // Reactions are read through a PR-shaped lookup, so issue comments turn them
  // off until that has an issue twin.
  showReactions?: boolean;
}

export default function CommentCard({
  comment,
  repo,
  number,
  showReactions = true,
}: Props) {
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
        {showReactions && (
          <ReactionBar
            repo={repo}
            prNumber={number}
            commentId={comment.id}
            commentNodeId={comment.nodeId}
          />
        )}
      </Box>
    </Box>
  );
}
