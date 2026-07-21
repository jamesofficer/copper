import { Box, HStack, Icon, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuCircleCheck, LuCircleX, LuMessageSquare } from "react-icons/lu";
import type { PullRequestReview } from "../../../shared/types";
import { formatDate } from "../lib/formatDate";
import Markdown from "./Markdown";
import UserAvatar from "./UserAvatar";

interface Props {
  review: PullRequestReview;
}

const verdictMeta: Record<
  PullRequestReview["state"],
  { phrase: string; color: string; icon: ReactNode }
> = {
  approved: {
    phrase: "approved these changes",
    color: "green.fg",
    icon: <LuCircleCheck />,
  },
  changes_requested: {
    phrase: "requested changes",
    color: "red.fg",
    icon: <LuCircleX />,
  },
  commented: {
    phrase: "left a review",
    color: "fg.muted",
    icon: <LuMessageSquare />,
  },
  dismissed: {
    phrase: "dismissed a review",
    color: "fg.muted",
    icon: <LuMessageSquare />,
  },
};

export default function ReviewCard({ review }: Props) {
  const meta = verdictMeta[review.state];
  const hasBody = review.body.trim().length > 0;

  return (
    <Box borderWidth="1px" rounded="lg" overflow="hidden">
      <HStack
        gap="2"
        px="4"
        py="2.5"
        bg="bg.subtle"
        borderBottomWidth={hasBody ? "1px" : "0"}
      >
        <UserAvatar username={review.author} />
        <Icon color={meta.color}>{meta.icon}</Icon>
        <Text fontSize="sm">
          <Text as="span" fontWeight="medium">
            {review.author}
          </Text>{" "}
          <Text as="span" color="fg.muted">
            {meta.phrase}
          </Text>
        </Text>
        <Text fontSize="xs" color="fg.subtle">
          {formatDate(review.submittedAt)}
        </Text>
      </HStack>
      {hasBody && (
        <Box px="4" py="3">
          <Markdown>{review.body}</Markdown>
        </Box>
      )}
    </Box>
  );
}
