import type { SyntaxThemePair } from "./syntaxTheme";
import { findSyntaxTheme } from "./syntaxThemeCatalog";

// Shiki emits each token's github-dark and github-light colours as CSS
// variables on a .tok span (see tokenHtml in highlighter.ts); these rules
// pick the one matching the colour mode via the .dark/.light class on <html>.
// Shared by the diff renderer and markdown code blocks.
export const tokenColors = {
  ".dark & .tok": { color: "var(--shiki-dark)" },
  ".light & .tok": { color: "var(--shiki-light)" },
} as const;

// The chosen theme's own background for the surfaces that render highlighted
// code — token colours were designed against it, so a diff keeps the app
// background only until the user picks a theme whose canvas differs. Like
// tokenColors, the colour-mode class picks which half of the pair applies.
// The selector targets a descendant instead of the element itself (e.g.
// "& pre" for markdown's code blocks).
export function syntaxBackground(themes: SyntaxThemePair, selector = "&") {
  return {
    [`.dark ${selector}`]: {
      backgroundColor: findSyntaxTheme(themes.dark)?.bg,
    },
    [`.light ${selector}`]: {
      backgroundColor: findSyntaxTheme(themes.light)?.bg,
    },
  } as const;
}
