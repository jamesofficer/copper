import { useSyncExternalStore } from "react";

// How the Changes tab's file list writes a path: the whole path on one line,
// just the file name, or the name with its folder underneath.
export const filePathDisplays = ["inline", "filename", "stacked"] as const;

export type FilePathDisplay = (typeof filePathDisplays)[number];

const STORAGE_KEY = "filePathDisplay";

function isFilePathDisplay(value: string | null): value is FilePathDisplay {
  return filePathDisplays.includes(value as FilePathDisplay);
}

function load(): FilePathDisplay {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isFilePathDisplay(stored) ? stored : "stacked";
}

let current = load();
const listeners = new Set<() => void>();

export function getFilePathDisplay(): FilePathDisplay {
  return current;
}

export function setFilePathDisplay(display: FilePathDisplay): void {
  current = display;
  localStorage.setItem(STORAGE_KEY, display);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFilePathDisplay(): FilePathDisplay {
  return useSyncExternalStore(subscribe, getFilePathDisplay);
}
