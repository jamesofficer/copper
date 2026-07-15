// github-dark token palette, applied to highlight.js output. Shared by the
// diff renderer and markdown code blocks.
export const tokenColors = {
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
