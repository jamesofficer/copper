import { useSyncExternalStore } from "react";

// Whether the app's left sidebar is hidden. Global, so the home screen and the
// review screen agree, and persisted so a reviewer who wants the full width
// keeps it across sessions.
const STORAGE_KEY = "sidebarCollapsed";

function load(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

let current = load();
const listeners = new Set<() => void>();

export function getSidebarCollapsed(): boolean {
  return current;
}

export function setSidebarCollapsed(collapsed: boolean): void {
  current = collapsed;
  localStorage.setItem(STORAGE_KEY, String(collapsed));
  for (const listener of listeners) listener();
}

export function toggleSidebar(): void {
  setSidebarCollapsed(!current);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribe, getSidebarCollapsed);
}
