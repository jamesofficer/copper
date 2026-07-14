// Themed webkit scrollbar: transparent track, rounded thumb inset from the
// edge, lightening on hover. Spread into a Chakra `css` prop.
export const scrollbar = {
  "&::-webkit-scrollbar": { width: "14px", height: "14px" },
  "&::-webkit-scrollbar-track": { background: "transparent" },
  "&::-webkit-scrollbar-thumb": {
    background: "var(--chakra-colors-border-emphasized)",
    borderRadius: "9999px",
    border: "4px solid transparent",
    backgroundClip: "padding-box",
  },
  "&::-webkit-scrollbar-thumb:hover": {
    background: "var(--chakra-colors-border-muted)",
    backgroundClip: "padding-box",
  },
  "&::-webkit-scrollbar-corner": { background: "transparent" },
} as const;
