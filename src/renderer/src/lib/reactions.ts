import {
  type PullRequestReactions,
  type ReactionContent,
  type ReactionGroup,
  reactionContents,
} from "../../../shared/types";

export const reactionEmoji: Record<ReactionContent, string> = {
  THUMBS_UP: "👍",
  THUMBS_DOWN: "👎",
  LAUGH: "😄",
  HOORAY: "🎉",
  CONFUSED: "😕",
  HEART: "❤️",
  ROCKET: "🚀",
  EYES: "👀",
};

export const reactionLabel: Record<ReactionContent, string> = {
  THUMBS_UP: "Thumbs up",
  THUMBS_DOWN: "Thumbs down",
  LAUGH: "Laugh",
  HOORAY: "Hooray",
  CONFUSED: "Confused",
  HEART: "Heart",
  ROCKET: "Rocket",
  EYES: "Eyes",
};

// Always the same left-to-right order, so adding an emoji never shuffles the
// ones already on a comment.
export function orderReactions(groups: ReactionGroup[]): ReactionGroup[] {
  return [...groups].sort(
    (a, b) =>
      reactionContents.indexOf(a.content) - reactionContents.indexOf(b.content),
  );
}

// Toggle the viewer's reaction locally, so a click shows straight away instead
// of waiting for GitHub. The next fetch brings back the same result.
export function applyReaction(
  groups: ReactionGroup[],
  content: ReactionContent,
  reacted: boolean,
): ReactionGroup[] {
  const existing = groups.find((group) => group.content === content);
  if (!existing) {
    return reacted
      ? [...groups, { content, count: 1, viewerHasReacted: true }]
      : groups;
  }

  const count = existing.count + (reacted ? 1 : -1);
  if (count <= 0) {
    return groups.filter((group) => group.content !== content);
  }
  return groups.map((group) =>
    group.content === content
      ? { ...group, count, viewerHasReacted: reacted }
      : group,
  );
}

export function applyReactionToMap(
  reactions: PullRequestReactions,
  commentId: number,
  content: ReactionContent,
  reacted: boolean,
): PullRequestReactions {
  return {
    ...reactions,
    [commentId]: applyReaction(reactions[commentId] ?? [], content, reacted),
  };
}
