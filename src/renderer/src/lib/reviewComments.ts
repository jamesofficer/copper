import type { ReviewComment } from "../../../shared/types";

// One inline discussion on a diff line: the comment that opened it plus its
// replies, oldest first.
export interface ReviewThread {
  root: ReviewComment;
  replies: ReviewComment[];
}

// Group a PR's review comments into threads per file. Threads whose anchor
// is outdated (GitHub reports no current line) are dropped — they point at
// code the diff no longer shows.
export function buildReviewThreads(
  comments: ReviewComment[],
): Map<string, ReviewThread[]> {
  const threadsByRoot = new Map<number, ReviewThread>();
  const byPath = new Map<string, ReviewThread[]>();

  for (const comment of comments) {
    if (comment.inReplyTo !== null) {
      threadsByRoot.get(comment.inReplyTo)?.replies.push(comment);
      continue;
    }
    const thread: ReviewThread = { root: comment, replies: [] };
    threadsByRoot.set(comment.id, thread);
    if (comment.line === null) continue;
    const list = byPath.get(comment.path);
    if (list) list.push(thread);
    else byPath.set(comment.path, [thread]);
  }

  return byPath;
}
