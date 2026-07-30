import { useSyncExternalStore } from "react";

// Which home-sidebar sections the user has collapsed. Stored by section id so
// the sidebar comes back the way it was left, and so adding a new section
// starts it expanded rather than inheriting someone else's saved state.
const STORAGE_KEY = "collapsedSidebarSections";

function load(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

let current = load();
const listeners = new Set<() => void>();

function save(ids: string[]): void {
  current = ids;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  for (const listener of listeners) listener();
}

function getSnapshot(): string[] {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSectionOpen(id: string, open: boolean): void {
  if (open) {
    save(current.filter((collapsed) => collapsed !== id));
  } else if (!current.includes(id)) {
    save([...current, id]);
  }
}

export function useCollapsedSections(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}
