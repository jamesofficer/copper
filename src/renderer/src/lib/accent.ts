// The accent colour is a Chakra colour palette applied app-wide. It's set as
// a data attribute on <html> (so portalled dialogs and toasts inherit it too)
// and matched by globalCss rules in theme.ts.
export const accentPalettes = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "cyan",
  "purple",
  "pink",
] as const;

export type AccentPalette = (typeof accentPalettes)[number];

export const defaultAccent: AccentPalette = "green";

const STORAGE_KEY = "accentPalette";

function isAccentPalette(value: string | null): value is AccentPalette {
  return accentPalettes.includes(value as AccentPalette);
}

export function getAccent(): AccentPalette {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isAccentPalette(stored) ? stored : defaultAccent;
}

export function applyAccent(accent: AccentPalette): void {
  document.documentElement.dataset.accent = accent;
  localStorage.setItem(STORAGE_KEY, accent);
}
