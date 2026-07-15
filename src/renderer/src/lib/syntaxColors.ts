// github-dark / github-light token palettes, applied to highlight.js output.
// Shared by the diff renderer and markdown code blocks. Scoped to the .dark /
// .light class on <html> so they follow the colour mode.
const darkTokens = {
  "& .hljs-keyword, & .hljs-built_in": { color: "#ff7b72" },
  "& .hljs-string, & .hljs-regexp, & .hljs-char.escape_": { color: "#a5d6ff" },
  "& .hljs-comment, & .hljs-quote": { color: "#8b949e", fontStyle: "italic" },
  "& .hljs-number, & .hljs-literal": { color: "#79c0ff" },
  "& .hljs-title, & .hljs-title.function_, & .hljs-title.class_": {
    color: "#d2a8ff",
  },
  "& .hljs-attr, & .hljs-attribute, & .hljs-variable, & .hljs-property": {
    color: "#79c0ff",
  },
  "& .hljs-tag, & .hljs-name, & .hljs-selector-tag": { color: "#7ee787" },
  "& .hljs-type, & .hljs-symbol, & .hljs-bullet": { color: "#ffa657" },
  "& .hljs-meta": { color: "#8b949e" },
  // ```diff blocks (the diff renderer colors whole rows itself instead)
  "& .hljs-addition": { color: "#aff5b4", background: "#03301777" },
  "& .hljs-deletion": { color: "#ffdcd7", background: "#67060c66" },
} as const;

const lightTokens = {
  "& .hljs-keyword, & .hljs-built_in": { color: "#cf222e" },
  "& .hljs-string, & .hljs-regexp, & .hljs-char.escape_": { color: "#0a3069" },
  "& .hljs-comment, & .hljs-quote": { color: "#6e7781", fontStyle: "italic" },
  "& .hljs-number, & .hljs-literal": { color: "#0550ae" },
  "& .hljs-title, & .hljs-title.function_, & .hljs-title.class_": {
    color: "#8250df",
  },
  "& .hljs-attr, & .hljs-attribute, & .hljs-variable, & .hljs-property": {
    color: "#0550ae",
  },
  "& .hljs-tag, & .hljs-name, & .hljs-selector-tag": { color: "#116329" },
  "& .hljs-type, & .hljs-symbol, & .hljs-bullet": { color: "#953800" },
  "& .hljs-meta": { color: "#6e7781" },
  "& .hljs-addition": { color: "#116329", background: "#dafbe1aa" },
  "& .hljs-deletion": { color: "#82071e", background: "#ffebe9aa" },
} as const;

function scoped(mode: string, tokens: Record<string, object>) {
  return Object.fromEntries(
    Object.entries(tokens).map(([selector, style]) => [
      selector.replaceAll("&", `${mode} &`),
      style,
    ]),
  );
}

export const tokenColors = {
  ...scoped(".dark", darkTokens),
  ...scoped(".light", lightTokens),
} as const;
