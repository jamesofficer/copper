import { Badge, HStack, Text, VStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuCircleCheck, LuCircleDashed, LuCircleX } from "react-icons/lu";
import type { PullRequestReview } from "../../../shared/types";
import RelativeTime from "./RelativeTime";
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

// Who has reviewed and who still owes one. Lives in the overview's rail, so it
// carries no heading of its own and states the empty case rather than
// vanishing — an empty "Reviewers" section is the answer to "who's looking at
// this?", not clutter.
export default function ReviewSummary({ reviews, requestedReviewers }: Props) {
  const decisions = decisionsByReviewer(reviews);
  const decided = new Set(decisions.map((d) => d.author));
  const awaiting = requestedReviewers.filter((login) => !decided.has(login));

  if (decisions.length === 0 && awaiting.length === 0) {
    return (
      <Text fontSize="sm" color="fg.muted">
        No reviewers yet
      </Text>
    );
  }

  return (
    <VStack gap="3" alignItems="stretch">
      {decisions.map((decision) => {
        const meta = decisionMeta[decision.state];
        return (
          <HStack key={decision.author} gap="2" alignItems="flex-start">
            <UserAvatar username={decision.author} />
            <VStack gap="1" alignItems="flex-start" minW="0">
              <Text fontFamily="mono" fontSize="sm" truncate maxW="full">
                {decision.author}
              </Text>
              <HStack gap="2">
                <Badge colorPalette={meta.palette} variant="surface" size="sm">
                  {meta.icon}
                  {meta.label}
                </Badge>
                <RelativeTime
                  iso={decision.submittedAt}
                  color="fg.subtle"
                  fontSize="xs"
                />
              </HStack>
            </VStack>
          </HStack>
        );
      })}
      {awaiting.map((login) => (
        <HStack key={login} gap="2" alignItems="flex-start">
          <UserAvatar username={login} />
          <VStack gap="1" alignItems="flex-start" minW="0">
            <Text fontFamily="mono" fontSize="sm" color="fg.muted" truncate>
              {login}
            </Text>
            <Badge colorPalette="orange" variant="surface" size="sm">
              <LuCircleDashed />
              Awaiting review
            </Badge>
          </VStack>
        </HStack>
      ))}
    </VStack>
  );
}
