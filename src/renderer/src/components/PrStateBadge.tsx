import { Badge } from "@chakra-ui/react";
import {
  LuGitMerge,
  LuGitPullRequest,
  LuGitPullRequestClosed,
  LuGitPullRequestDraft,
} from "react-icons/lu";

interface Props {
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
  size?: "xs" | "sm" | "md" | "lg";
}

function meta({ state, draft, merged }: Omit<Props, "size">) {
  if (merged) {
    return { label: "Merged", palette: "purple", icon: <LuGitMerge /> };
  }
  if (state === "closed") {
    return {
      label: "Closed",
      palette: "red",
      icon: <LuGitPullRequestClosed />,
    };
  }
  if (draft) {
    return { label: "Draft", palette: "gray", icon: <LuGitPullRequestDraft /> };
  }
  return { label: "Open", palette: "blue", icon: <LuGitPullRequest /> };
}

export default function PrStateBadge({ size, ...stateProps }: Props) {
  const state = meta(stateProps);
  return (
    <Badge colorPalette={state.palette} variant="surface" size={size}>
      {state.icon}
      {state.label}
    </Badge>
  );
}
