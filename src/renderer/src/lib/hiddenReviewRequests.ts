import { useSyncExternalStore } from "react";

// Review requests the user has hidden from the sidebar — a local "not now",
// not a change on GitHub. Hidden entries stay hidden until they're restored by
// hand, so the section header offers a Show-hidden toggle rather than making
// rows silently reappear.
const STORAGE_KEY = "hiddenReviewRequests";

export function reviewRequestKey(pr: { repo: string; number: number }): string {
  return `${pr.repo}#${pr.number}`;
}

function load(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === "string")
      : [];
  } catch {
    return [];
  }
}

let current = load();
const listeners = new Set<() => void>();

function save(keys: string[]): void {
  current = keys;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  for (const listener of listeners) listener();
}

function getSnapshot(): string[] {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hideReviewRequest(key: string): void {
  if (current.includes(key)) return;
  save([...current, key]);
}

export function showReviewRequest(key: string): void {
  save(current.filter((hidden) => hidden !== key));
}

export function useHiddenReviewRequests(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}
