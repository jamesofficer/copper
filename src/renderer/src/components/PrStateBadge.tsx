import { Badge } from "@chakra-ui/react";
import {
  LuGitMerge,
  LuGitPullRequest,
  LuGitPullRequestClosed,
  LuGitPullRequestDraft,
} from "react-icons/lu";

export interface PrState {
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
}

interface Props extends PrState {
  size?: "xs" | "sm" | "md" | "lg";
}

// The four states a PR can be in, as one table. Exported because the queue rows
// carry the same state as a tinted icon rather than a badge, and two components
// deciding "is this merged or just closed" separately is how they drift apart.
export function prStateMeta({ state, draft, merged }: PrState) {
  if (merged) {
    return {
      kind: "merged" as const,
      label: "Merged",
      palette: "purple",
      icon: <LuGitMerge />,
    };
  }
  if (state === "closed") {
    return {
      kind: "closed" as const,
      label: "Closed",
      palette: "red",
      icon: <LuGitPullRequestClosed />,
    };
  }
  if (draft) {
    return {
      kind: "draft" as const,
      label: "Draft",
      palette: "gray",
      icon: <LuGitPullRequestDraft />,
    };
  }
  return {
    kind: "open" as const,
    label: "Open",
    palette: "blue",
    icon: <LuGitPullRequest />,
  };
}

export default function PrStateBadge({ size, ...stateProps }: Props) {
  const state = prStateMeta(stateProps);
  return (
    <Badge colorPalette={state.palette} variant="surface" size={size}>
      {state.icon}
      {state.label}
    </Badge>
  );
}
