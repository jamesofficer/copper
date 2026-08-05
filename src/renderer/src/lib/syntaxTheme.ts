import { useSyncExternalStore } from "react";
import {
  resolveSyntaxThemeId,
  type ThemeAppearance,
} from "./syntaxThemeCatalog";

// Which syntax theme the highlighter uses, one per colour mode: a good dark
// theme is rarely a good light theme, so the setting is a pair and the active
// half follows the resolved colour mode. Global and persisted, like
// diffViewMode — every diff, file view, and markdown code block reads it.
export interface SyntaxThemePair {
  dark: string;
  light: string;
}

const STORAGE_KEYS: Record<ThemeAppearance, string> = {
  dark: "syntaxThemeDark",
  light: "syntaxThemeLight",
};

function load(): SyntaxThemePair {
  // Each mode falls back on its own: a theme id dropped by a Shiki upgrade
  // shouldn't cost the user the choice they made for the other mode.
  return {
    dark: resolveSyntaxThemeId(localStorage.getItem(STORAGE_KEYS.dark), "dark"),
    light: resolveSyntaxThemeId(
      localStorage.getItem(STORAGE_KEYS.light),
      "light",
    ),
  };
}

let current = load();
const listeners = new Set<() => void>();

// Returns the same object until a theme changes: useSyncExternalStore compares
// snapshots by reference and re-renders forever if this is new every call.
export function getSyntaxThemes(): SyntaxThemePair {
  return current;
}

export function setSyntaxTheme(appearance: ThemeAppearance, id: string): void {
  current = { ...current, [appearance]: id };
  localStorage.setItem(STORAGE_KEYS[appearance], id);
  for (const listener of listeners) listener();
}

export function subscribeToSyntaxThemes(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Every mounted diff subscribes, so changing a theme re-highlights them all.
export function useSyntaxThemes(): SyntaxThemePair {
  return useSyncExternalStore(subscribeToSyntaxThemes, getSyntaxThemes);
}
