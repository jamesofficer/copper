import { useSyncExternalStore } from "react";

let current = false;
let stopListening: (() => void) | undefined;
const listeners = new Set<() => void>();

function publish(fullscreen: boolean): void {
  if (fullscreen === current) return;
  current = fullscreen;
  for (const listener of listeners) listener();
}

// Start after preload exposes window.api. Preload retains the latest state, so
// a renderer that starts or reloads in full screen reads the correct value.
export function startWindowFullscreenTracking(): void {
  stopListening?.();
  stopListening = window.api.onWindowFullscreenChange(publish);
  publish(window.api.isWindowFullscreen());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWindowFullscreen(): boolean {
  return current;
}

export function useWindowFullscreen(): boolean {
  return useSyncExternalStore(subscribe, getWindowFullscreen);
}
