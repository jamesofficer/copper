import { Badge, Box, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuCircleCheck, LuCircleDashed, LuCircleX } from "react-icons/lu";
import type { PullRequestReview } from "../../../shared/types";
import { formatDate } from "../lib/formatDate";
import UserAvatar from "./UserAvatar";

interface Props {
  reviews: PullRequestReview[];
  requestedReviewers: string[];
}

interface ReviewerDecision {
  author: string;
  state: "approved" | "changes_requested";
  submittedAt: string;
}

// GitHub's decision rule: reviews arrive oldest-first, so each reviewer's
// latest approval/changes-requested wins and a dismissal wipes their vote.
// Plain comments never change a standing verdict.
function decisionsByReviewer(reviews: PullRequestReview[]): ReviewerDecision[] {
  const latest = new Map<string, ReviewerDecision>();
  for (const review of reviews) {
    if (review.state === "approved" || review.state === "changes_requested") {
      latest.set(review.author, {
        author: review.author,
        state: review.state,
        submittedAt: review.submittedAt,
      });
    } else if (review.state === "dismissed") {
      latest.delete(review.author);
    }
  }
  return [...latest.values()];
}

const decisionMeta: Record<
  ReviewerDecision["state"],
  { label: string; palette: string; icon: ReactNode }
> = {
  approved: { label: "Approved", palette: "green", icon: <LuCircleCheck /> },
  changes_requested: {
    label: "Requested changes",
    palette: "red",
    icon: <LuCircleX />,
  },
};

export default function ReviewSummary({ reviews, requestedReviewers }: Props) {
  const decisions = decisionsByReviewer(reviews);
  const decided = new Set(decisions.map((d) => d.author));
  const awaiting = requestedReviewers.filter((login) => !decided.has(login));

  if (decisions.length === 0 && awaiting.length === 0) return null;

  return (
    <Box>
      <Heading
        size="xs"
        color="fg.muted"
        textTransform="uppercase"
        letterSpacing="wider"
        mb="3"
      >
        Reviews
      </Heading>
      <VStack gap="2" alignItems="stretch">
        {decisions.map((decision) => {
          const meta = decisionMeta[decision.state];
          return (
            <HStack key={decision.author} fontSize="sm" gap="2">
              <UserAvatar username={decision.author} />
              <Text fontFamily="mono">{decision.author}</Text>
              <Badge colorPalette={meta.palette} variant="surface" size="sm">
                {meta.icon}
                {meta.label}
              </Badge>
              <Text color="fg.subtle" fontSize="xs">
                {formatDate(decision.submittedAt)}
              </Text>
            </HStack>
          );
        })}
        {awaiting.map((login) => (
          <HStack key={login} fontSize="sm" gap="2" color="fg.muted">
            <UserAvatar username={login} />
            <Text fontFamily="mono">{login}</Text>
            <Badge colorPalette="orange" variant="surface" size="sm">
              <LuCircleDashed />
              Awaiting review
            </Badge>
          </HStack>
        ))}
      </VStack>
    </Box>
  );
}
