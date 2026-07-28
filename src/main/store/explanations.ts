import { randomUUID } from "node:crypto";
import type { Explanation } from "../../shared/types";
import { createJsonStore } from "./jsonStore";

// Local-only AI explanations of diff ranges, keyed by repo#number. Disk-backed
// so they survive restarts; never posted to GitHub.
const explanations = createJsonStore<Explanation[]>("explanations.json");

function explanationsKey(repo: string, prNumber: number): string {
  return `${repo}#${prNumber}`;
}

export async function listExplanations(
  repo: string,
  prNumber: number,
): Promise<Explanation[]> {
  const store = await explanations.load();
  return store.get(explanationsKey(repo, prNumber)) ?? [];
}

export async function addExplanation(
  repo: string,
  prNumber: number,
  entry: Omit<Explanation, "id" | "createdAt">,
): Promise<Explanation> {
  const store = await explanations.load();
  const explanation: Explanation = {
    ...entry,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const key = explanationsKey(repo, prNumber);
  store.set(key, [...(store.get(key) ?? []), explanation]);
  await explanations.persist(store);
  return explanation;
}

export async function deleteExplanation(
  repo: string,
  prNumber: number,
  explanationId: string,
): Promise<void> {
  const store = await explanations.load();
  const key = explanationsKey(repo, prNumber);
  const remaining = (store.get(key) ?? []).filter(
    (entry) => entry.id !== explanationId,
  );
  if (remaining.length > 0) store.set(key, remaining);
  else store.delete(key);
  await explanations.persist(store);
}
