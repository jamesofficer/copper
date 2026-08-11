import { Separator, Text, VStack } from "@chakra-ui/react";
import type { RepoIssueDetail } from "../../../shared/types";
import LabelBadges from "./LabelBadges";
import OpenedUpdatedLine from "./OpenedUpdatedLine";
import RailSection from "./RailSection";
import UserList from "./UserList";

interface Props {
  detail: RepoIssueDetail;
}

// The issue panel's rail. The same sections as a pull request's, minus the ones
// an issue has no answer for: it has no reviewers and nothing to review, so
// there is no review status and no reviewer list.
export default function RepoIssueSidebar({ detail }: Props) {
  return (
    <VStack gap="5" alignItems="stretch" separator={<Separator />}>
      <RailSection title="Assignees">
        <UserList logins={detail.assignees} empty="Nobody assigned" />
      </RailSection>

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
