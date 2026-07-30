import { IconButton } from "@chakra-ui/react";
import { LuEyeOff } from "react-icons/lu";
import type { PullRequest } from "../../../shared/types";
import {
  hideReviewRequest,
  reviewRequestKey,
} from "../lib/hiddenReviewRequests";

interface Props {
  pr: PullRequest;
}

// Hides an old review request from the sidebar — instant, reversible, and
// invisible to GitHub. Actually taking yourself off the reviewers is
// outward-facing, so it lives on the PR's Overview instead of here.
export default function ReviewRequestActions({ pr }: Props) {
  return (
    <IconButton
      aria-label="Hide from this list"
      title="Hide from this list"
      size="2xs"
      variant="ghost"
      color="fg.muted"
      onClick={() => hideReviewRequest(reviewRequestKey(pr))}
    >
      <LuEyeOff />
    </IconButton>
  );
}
