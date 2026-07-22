import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { DraftReviewComment, NewReviewComment } from "../../shared/types";

// Inline comments drafted for a batch review, keyed by repo#number.
// Disk-backed so a half-written review survives app restarts.
const configDir = join(homedir(), ".pr-reviewer");
const draftsPath = join(configDir, "drafts.json");

let cache: Map<string, DraftReviewComment[]> | null = null;

function draftsKey(repo: string, prNumber: number): string {
  return `${repo}#${prNumber}`;
}

async function loadDrafts(): Promise<Map<string, DraftReviewComment[]>> {
  if (cache) return cache;
  try {
    const raw = JSON.parse(await readFile(draftsPath, "utf8")) as Record<
      string,
      DraftReviewComment[]
    >;
    cache = new Map(Object.entries(raw));
  } catch {
    cache = new Map();
  }
  return cache;
}

async function persist(
  store: Map<string, DraftReviewComment[]>,
): Promise<void> {
  await mkdir(configDir, { recursive: true });
  await writeFile(
    draftsPath,
    JSON.stringify(Object.fromEntries(store), null, 2),
  );
}

export async function listDraftComments(
  repo: string,
  prNumber: number,
): Promise<DraftReviewComment[]> {
  const store = await loadDrafts();
  return store.get(draftsKey(repo, prNumber)) ?? [];
}

export async function addDraftComment(
  repo: string,
  prNumber: number,
  comment: NewReviewComment,
): Promise<DraftReviewComment> {
  const store = await loadDrafts();
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
  await persist(store);
  return draft;
}

export async function updateDraftComment(
  repo: string,
  prNumber: number,
  draftId: string,
  body: string,
): Promise<DraftReviewComment> {
  const store = await loadDrafts();
  const draft = store
    .get(draftsKey(repo, prNumber))
    ?.find((entry) => entry.id === draftId);
  if (!draft) {
    throw new Error("This draft comment no longer exists.");
  }
  draft.body = body;
  await persist(store);
  return draft;
}

export async function deleteDraftComment(
  repo: string,
  prNumber: number,
  draftId: string,
): Promise<void> {
  const store = await loadDrafts();
  const key = draftsKey(repo, prNumber);
  const remaining = (store.get(key) ?? []).filter(
    (entry) => entry.id !== draftId,
  );
  if (remaining.length > 0) store.set(key, remaining);
  else store.delete(key);
  await persist(store);
}

export async function clearDraftComments(
  repo: string,
  prNumber: number,
): Promise<void> {
  const store = await loadDrafts();
  store.delete(draftsKey(repo, prNumber));
  await persist(store);
}
