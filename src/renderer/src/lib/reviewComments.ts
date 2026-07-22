import type { ReviewComment } from "../../../shared/types";

// One inline discussion on a diff line: the comment that opened it plus its
// replies, oldest first.
export interface ReviewThread {
  root: ReviewComment;
  replies: ReviewComment[];
}

// Group a PR's review comments into threads, oldest first. Includes threads
// whose anchor is outdated (GitHub reports no current line) — the Overview's
// conversation still shows those.
export function listReviewThreads(comments: ReviewComment[]): ReviewThread[] {
  const threadsByRoot = new Map<number, ReviewThread>();
  const threads: ReviewThread[] = [];

  for (const comment of comments) {
    if (comment.inReplyTo !== null) {
      const parent = threadsByRoot.get(comment.inReplyTo);
      if (parent) {
        parent.replies.push(comment);
        continue;
      }
      // The comment this replied to was deleted — promote the reply to a
      // root so the rest of the thread isn't lost, and let its siblings
      // (which point at the same deleted id) attach to it.
      const thread: ReviewThread = { root: comment, replies: [] };
      threadsByRoot.set(comment.inReplyTo, thread);
      threads.push(thread);
      continue;
    }
    const thread: ReviewThread = { root: comment, replies: [] };
    threadsByRoot.set(comment.id, thread);
    threads.push(thread);
  }

  return threads;
}

// Threads per file for the diff view. Outdated threads are dropped — they
// point at code the diff no longer shows.
export function buildReviewThreads(
  comments: ReviewComment[],
): Map<string, ReviewThread[]> {
  const byPath = new Map<string, ReviewThread[]>();

  for (const thread of listReviewThreads(comments)) {
    if (thread.root.line === null) continue;
    const list = byPath.get(thread.root.path);
    if (list) list.push(thread);
    else byPath.set(thread.root.path, [thread]);
  }

  return byPath;
}

// "line 12" / "lines 8–12", with a note when the range is on the old side.
export function formatThreadRange(root: ReviewComment): string | null {
  if (root.line === null) return null;
  const range =
    root.startLine !== null && root.startLine < root.line
      ? `lines ${root.startLine}–${root.line}`
      : `line ${root.line}`;
  return root.side === "LEFT" ? `${range} of the old version` : range;
}
