import { Badge } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuCircleCheck, LuCircleDashed, LuCircleX } from "react-icons/lu";
import type { ReviewStatus } from "../../../shared/types";

const meta: Record<
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

interface Props {
  status?: ReviewStatus;
  size?: "xs" | "sm" | "md" | "lg";
}

export default function ReviewStatusBadge({ status, size }: Props) {
  // PR lists cached before this field existed don't carry it.
  if (!status) return null;
  const state = meta[status];
  return (
    <Badge colorPalette={state.palette} variant="surface" size={size}>
      {state.icon}
      {state.label}
    </Badge>
  );
}
