// Shiki emits each token's github-dark and github-light colours as CSS
// variables on a .tok span (see tokenHtml in highlighter.ts); these rules
// pick the one matching the colour mode via the .dark/.light class on <html>.
// Shared by the diff renderer and markdown code blocks.
export const tokenColors = {
  ".dark & .tok": { color: "var(--shiki-dark)" },
  ".light & .tok": { color: "var(--shiki-light)" },
} as const;
