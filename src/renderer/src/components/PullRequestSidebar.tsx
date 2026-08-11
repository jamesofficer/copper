import { HStack, Separator, Text, VStack } from "@chakra-ui/react";
import type {
  PullRequestDetail,
  PullRequestReview,
} from "../../../shared/types";
import LabelBadges from "./LabelBadges";
import OpenedUpdatedLine from "./OpenedUpdatedLine";
import RailSection from "./RailSection";
import ReviewProgress from "./ReviewProgress";
import ReviewSummary from "./ReviewSummary";
import UserAvatar from "./UserAvatar";

interface Props {
  detail: PullRequestDetail;
  reviews: PullRequestReview[];
  // The review-progress rail reads state that only the full review screen can
  // act on (viewed files, draft comments), and each read is a request; the
  // home-screen preview is a quick look, so it doesn't spend them.
  showProgress?: boolean;
}

// The overview's right-hand rail: the PR's standing facts — where the review
// has got to, who is looking at it, how it's tagged — beside the reading
// column rather than stacked above it, so the description starts at the top of
// the panel.
export default function PullRequestSidebar({
  detail,
  reviews,
  showProgress,
}: Props) {
  return (
    <VStack gap="5" alignItems="stretch" separator={<Separator />}>
      {showProgress && (
        <RailSection title="Review status">
          <ReviewProgress detail={detail} reviews={reviews} />
        </RailSection>
      )}

      <RailSection title="Reviewers">
        <ReviewSummary
          reviews={reviews}
          requestedReviewers={detail.reviewers}
        />
      </RailSection>

      {detail.assignees.length > 0 && (
        <RailSection title="Assignees">
          <VStack gap="2" alignItems="stretch">
            {detail.assignees.map((login) => (
              <HStack key={login} gap="2">
                <UserAvatar username={login} />
                <Text fontFamily="mono" fontSize="sm" truncate>
                  {login}
                </Text>
              </HStack>
            ))}
          </VStack>
        </RailSection>
      )}

      <RailSection title="Labels">
        {detail.labels.length > 0 ? (
          <LabelBadges labels={detail.labels} size="sm" />
        ) : (
          <Text fontSize="sm" color="fg.muted">
            No labels
          </Text>
        )}
      </RailSection>

      <OpenedUpdatedLine
        createdAt={detail.createdAt}
        updatedAt={detail.updatedAt}
      />
    </VStack>
  );
}
