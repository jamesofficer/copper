import { useSyncExternalStore } from "react";

// How diffs render everywhere: unified rows, side-by-side columns, or
// "dynamic" — split when the diff's container is wide enough, inline when
// it isn't. Global setting, persisted across sessions.
export const diffViewModes = ["inline", "split", "dynamic"] as const;

export type DiffViewMode = (typeof diffViewModes)[number];

const STORAGE_KEY = "diffViewMode";

function isDiffViewMode(value: string | null): value is DiffViewMode {
  return diffViewModes.includes(value as DiffViewMode);
}

function load(): DiffViewMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isDiffViewMode(stored) ? stored : "inline";
}

let current = load();
const listeners = new Set<() => void>();

export function getDiffViewMode(): DiffViewMode {
  return current;
}

export function setDiffViewMode(mode: DiffViewMode): void {
  current = mode;
  localStorage.setItem(STORAGE_KEY, mode);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Every mounted diff subscribes, so changing the dropdown re-renders them all.
export function useDiffViewMode(): DiffViewMode {
  return useSyncExternalStore(subscribe, getDiffViewMode);
}
