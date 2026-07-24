import { randomUUID } from "node:crypto";
import type { DraftReviewComment, NewReviewComment } from "../../shared/types";
import { createJsonStore } from "./jsonStore";

// Inline comments drafted for a batch review, keyed by repo#number.
// Disk-backed so a half-written review survives app restarts.
const drafts = createJsonStore<DraftReviewComment[]>("drafts.json");

function draftsKey(repo: string, prNumber: number): string {
  return `${repo}#${prNumber}`;
}

export async function listDraftComments(
  repo: string,
  prNumber: number,
): Promise<DraftReviewComment[]> {
  const store = await drafts.load();
  return store.get(draftsKey(repo, prNumber)) ?? [];
}

export async function addDraftComment(
  repo: string,
  prNumber: number,
  comment: NewReviewComment,
): Promise<DraftReviewComment> {
  const store = await drafts.load();
  const draft: DraftReviewComment = {
    id: randomUUID(),
    path: comment.path,
    side: comment.side,
    line: comment.line,
    startLine: comment.startLine,
    body: comment.body,
    createdAt: new Date().toISOString(),
  };
  const key = draftsKey(repo, prNumber);
  store.set(key, [...(store.get(key) ?? []), draft]);
  await drafts.persist(store);
  return draft;
}

export async function updateDraftComment(
  repo: string,
  prNumber: number,
  draftId: string,
  body: string,
): Promise<DraftReviewComment> {
  const store = await drafts.load();
  const draft = store
    .get(draftsKey(repo, prNumber))
    ?.find((entry) => entry.id === draftId);
  if (!draft) {
    throw new Error("This draft comment no longer exists.");
  }
  draft.body = body;
  await drafts.persist(store);
  return draft;
}

export async function deleteDraftComment(
  repo: string,
  prNumber: number,
  draftId: string,
): Promise<void> {
  const store = await drafts.load();
  const key = draftsKey(repo, prNumber);
  const remaining = (store.get(key) ?? []).filter(
    (entry) => entry.id !== draftId,
  );
  if (remaining.length > 0) store.set(key, remaining);
  else store.delete(key);
  await drafts.persist(store);
}

export async function clearDraftComments(
  repo: string,
  prNumber: number,
): Promise<void> {
  const store = await drafts.load();
  store.delete(draftsKey(repo, prNumber));
  await drafts.persist(store);
}
