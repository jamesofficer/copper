import type { ThemeRegistrationAny } from "shiki/core";
import andromeeda from "shiki/themes/andromeeda.mjs";
import auroraX from "shiki/themes/aurora-x.mjs";
import ayuDark from "shiki/themes/ayu-dark.mjs";
import ayuLight from "shiki/themes/ayu-light.mjs";
import ayuMirage from "shiki/themes/ayu-mirage.mjs";
import catppuccinFrappe from "shiki/themes/catppuccin-frappe.mjs";
import catppuccinLatte from "shiki/themes/catppuccin-latte.mjs";
import catppuccinMacchiato from "shiki/themes/catppuccin-macchiato.mjs";
import catppuccinMocha from "shiki/themes/catppuccin-mocha.mjs";
import darkPlus from "shiki/themes/dark-plus.mjs";
import dracula from "shiki/themes/dracula.mjs";
import draculaSoft from "shiki/themes/dracula-soft.mjs";
import everforestDark from "shiki/themes/everforest-dark.mjs";
import everforestLight from "shiki/themes/everforest-light.mjs";
import githubDark from "shiki/themes/github-dark.mjs";
import githubDarkDefault from "shiki/themes/github-dark-default.mjs";
import githubDarkDimmed from "shiki/themes/github-dark-dimmed.mjs";
import githubDarkHighContrast from "shiki/themes/github-dark-high-contrast.mjs";
import githubLight from "shiki/themes/github-light.mjs";
import githubLightDefault from "shiki/themes/github-light-default.mjs";
import githubLightHighContrast from "shiki/themes/github-light-high-contrast.mjs";
import gruvboxDarkHard from "shiki/themes/gruvbox-dark-hard.mjs";
import gruvboxDarkMedium from "shiki/themes/gruvbox-dark-medium.mjs";
import gruvboxDarkSoft from "shiki/themes/gruvbox-dark-soft.mjs";
import gruvboxLightHard from "shiki/themes/gruvbox-light-hard.mjs";
import gruvboxLightMedium from "shiki/themes/gruvbox-light-medium.mjs";
import gruvboxLightSoft from "shiki/themes/gruvbox-light-soft.mjs";
import horizon from "shiki/themes/horizon.mjs";
import horizonBright from "shiki/themes/horizon-bright.mjs";
import houston from "shiki/themes/houston.mjs";
import kanagawaDragon from "shiki/themes/kanagawa-dragon.mjs";
import kanagawaLotus from "shiki/themes/kanagawa-lotus.mjs";
import kanagawaWave from "shiki/themes/kanagawa-wave.mjs";
import laserwave from "shiki/themes/laserwave.mjs";
import lightPlus from "shiki/themes/light-plus.mjs";
import materialTheme from "shiki/themes/material-theme.mjs";
import materialThemeDarker from "shiki/themes/material-theme-darker.mjs";
import materialThemeLighter from "shiki/themes/material-theme-lighter.mjs";
import materialThemeOcean from "shiki/themes/material-theme-ocean.mjs";
import materialThemePalenight from "shiki/themes/material-theme-palenight.mjs";
import minDark from "shiki/themes/min-dark.mjs";
import minLight from "shiki/themes/min-light.mjs";
import monokai from "shiki/themes/monokai.mjs";
import nightOwl from "shiki/themes/night-owl.mjs";
import nightOwlLight from "shiki/themes/night-owl-light.mjs";
import nord from "shiki/themes/nord.mjs";
import oneDarkPro from "shiki/themes/one-dark-pro.mjs";
import oneLight from "shiki/themes/one-light.mjs";
import plastic from "shiki/themes/plastic.mjs";
import poimandres from "shiki/themes/poimandres.mjs";
import red from "shiki/themes/red.mjs";
import rosePine from "shiki/themes/rose-pine.mjs";
import rosePineDawn from "shiki/themes/rose-pine-dawn.mjs";
import rosePineMoon from "shiki/themes/rose-pine-moon.mjs";
import slackDark from "shiki/themes/slack-dark.mjs";
import slackOchin from "shiki/themes/slack-ochin.mjs";
import snazzyLight from "shiki/themes/snazzy-light.mjs";
import solarizedDark from "shiki/themes/solarized-dark.mjs";
import solarizedLight from "shiki/themes/solarized-light.mjs";
import synthwave84 from "shiki/themes/synthwave-84.mjs";
import tokyoNight from "shiki/themes/tokyo-night.mjs";
import vesper from "shiki/themes/vesper.mjs";
import vitesseBlack from "shiki/themes/vitesse-black.mjs";
import vitesseDark from "shiki/themes/vitesse-dark.mjs";
import vitesseLight from "shiki/themes/vitesse-light.mjs";

// Every theme Shiki bundles. All 65 are imported statically so highlighting
// can stay synchronous — an async theme load would show a flash of
// uncoloured code on every switch — which costs ~1.3MB of bundled JS (the
// per-theme files under shiki/dist/themes are re-export stubs; the real data
// lives in @shikijs/themes). That is paid off local disk in a desktop app,
// and only the pair in use is ever registered (see ensureThemes in
// highlighter.ts), so the other 63 are never resolved into colour maps.
//
// Nothing here is hand-written per theme: the id, the label and the
// light/dark grouping all come off the theme object itself, so adding one is
// a single import plus a single line below.
const registrations: ThemeRegistrationAny[] = [
  andromeeda,
  auroraX,
  ayuDark,
  ayuLight,
  ayuMirage,
  catppuccinFrappe,
  catppuccinLatte,
  catppuccinMacchiato,
  catppuccinMocha,
  darkPlus,
  dracula,
  draculaSoft,
  everforestDark,
  everforestLight,
  githubDark,
  githubDarkDefault,
  githubDarkDimmed,
  githubDarkHighContrast,
  githubLight,
  githubLightDefault,
  githubLightHighContrast,
  gruvboxDarkHard,
  gruvboxDarkMedium,
  gruvboxDarkSoft,
  gruvboxLightHard,
  gruvboxLightMedium,
  gruvboxLightSoft,
  horizon,
  horizonBright,
  houston,
  kanagawaDragon,
  kanagawaLotus,
  kanagawaWave,
  laserwave,
  lightPlus,
  materialTheme,
  materialThemeDarker,
  materialThemeLighter,
  materialThemeOcean,
  materialThemePalenight,
  minDark,
  minLight,
  monokai,
  nightOwl,
  nightOwlLight,
  nord,
  oneDarkPro,
  oneLight,
  plastic,
  poimandres,
  red,
  rosePine,
  rosePineDawn,
  rosePineMoon,
  slackDark,
  slackOchin,
  snazzyLight,
  solarizedDark,
  solarizedLight,
  synthwave84,
  tokyoNight,
  vesper,
  vitesseBlack,
  vitesseDark,
  vitesseLight,
];

export type ThemeAppearance = "light" | "dark";

export interface SyntaxTheme {
  id: string;
  label: string;
  appearance: ThemeAppearance;
  // Handed to the highlighter on first use; see ensureThemes in highlighter.ts.
  registration: ThemeRegistrationAny;
  // The theme's own background and foreground, for the settings preview.
  bg: string;
  fg: string;
}

function describeTheme(registration: ThemeRegistrationAny): SyntaxTheme {
  const theme = registration as {
    name?: string;
    displayName?: string;
    type?: ThemeAppearance;
    bg?: string;
    fg?: string;
  };
  const id = theme.name ?? "";
  return {
    id,
    label: theme.displayName ?? id,
    appearance: theme.type === "light" ? "light" : "dark",
    registration,
    bg: theme.bg ?? "#000000",
    fg: theme.fg ?? "#ffffff",
  };
}

// Sorted by label, since that is what the picker shows — "GitHub Dark" sits
// under G, not under g-i-t-h-u-b-hyphen.
export const syntaxThemes: SyntaxTheme[] = registrations
  .map(describeTheme)
  .sort((a, b) => a.label.localeCompare(b.label));

const byId = new Map(syntaxThemes.map((theme) => [theme.id, theme]));

export function findSyntaxTheme(id: string): SyntaxTheme | undefined {
  return byId.get(id);
}

export function syntaxThemesFor(appearance: ThemeAppearance): SyntaxTheme[] {
  return syntaxThemes.filter((theme) => theme.appearance === appearance);
}

// What the app looked like before it was configurable, so an existing user
// sees no change until they choose otherwise.
export const defaultSyntaxThemeIds = {
  dark: "github-dark",
  light: "github-light",
} as const;

// A stored id can outlive the theme across a Shiki upgrade. Highlighting runs
// per hunk during render, so an unknown id has to degrade to the default
// rather than throw and take the whole diff down with it.
export function resolveSyntaxThemeId(
  id: string | null | undefined,
  appearance: ThemeAppearance,
): string {
  return id && byId.has(id) ? id : defaultSyntaxThemeIds[appearance];
}
