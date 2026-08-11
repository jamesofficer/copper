import { Badge } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuCircleCheck, LuCircleDashed, LuCircleX } from "react-icons/lu";
import type { ReviewStatus } from "../../../shared/types";

export const reviewStatusMeta: Record<
  ReviewStatus,
  { label: string; palette: string; icon: ReactNode }
> = {
  approved: {
    label: "Approved",
    palette: "green",
    icon: <LuCircleCheck />,
  },
  changes_requested: {
    label: "Changes requested",
    palette: "red",
    icon: <LuCircleX />,
  },
  awaiting_review: {
    label: "Awaiting review",
    palette: "orange",
    icon: <LuCircleDashed />,
  },
};

// "Awaiting review" is only meaningful while the PR is still open; a
// definitive verdict stays interesting even after merge/close.
export function shouldShowReviewStatus(
  state: "open" | "closed",
  merged: boolean,
  status?: ReviewStatus,
): boolean {
  if (!status) return false;
  return (state === "open" && !merged) || status !== "awaiting_review";
}

interface Props {
  status?: ReviewStatus;
  size?: "xs" | "sm" | "md" | "lg";
}

export default function ReviewStatusBadge({ status, size }: Props) {
  // PR lists cached before this field existed don't carry it.
  if (!status) return null;
  const state = reviewStatusMeta[status];
  return (
    <Badge colorPalette={state.palette} variant="surface" size={size}>
      {state.icon}
      {state.label}
    </Badge>
  );
}
