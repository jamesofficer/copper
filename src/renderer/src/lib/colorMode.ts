// Light/dark is driven by a .dark or .light class on <html> — Chakra's
// _light/_dark conditions key off it. "system" follows the OS preference,
// live. index.html ships class="dark" so the first paint isn't a white flash.
export const colorModeSettings = ["light", "dark", "system"] as const;

export type ColorModeSetting = (typeof colorModeSettings)[number];

const STORAGE_KEY = "colorMode";

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function isColorModeSetting(value: string | null): value is ColorModeSetting {
  return colorModeSettings.includes(value as ColorModeSetting);
}

export function getColorMode(): ColorModeSetting {
  const stored = localStorage.getItem(STORAGE_KEY);
  // Dark is the app's original look, so it stays the default.
  return isColorModeSetting(stored) ? stored : "dark";
}

export function applyColorMode(setting: ColorModeSetting): void {
  localStorage.setItem(STORAGE_KEY, setting);
  const resolved =
    setting === "system" ? (darkQuery.matches ? "dark" : "light") : setting;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  // Keeps native controls and scrollbars in step with the theme.
  root.style.colorScheme = resolved;
}

darkQuery.addEventListener("change", () => {
  if (getColorMode() === "system") applyColorMode("system");
});
