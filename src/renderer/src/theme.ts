import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import { accentPalettes, defaultAccent } from "./lib/accent";

// One rule per palette: whichever data-accent <html> carries wins. applyAccent
// in lib/accent.ts sets the attribute; the default covers first paint.
const accentRules = Object.fromEntries(
  accentPalettes.map((palette) => [
    `html[data-accent="${palette}"]`,
    { colorPalette: palette },
  ]),
);

const config = defineConfig({
  globalCss: {
    html: {
      colorPalette: defaultAccent,
    },
    ...accentRules,
    body: {
      bg: "bg",
      color: "fg",
    },
  },
  theme: {
    tokens: {
      fonts: {
        mono: {
          value: "'SF Mono', ui-monospace, Menlo, Consolas, monospace",
        },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: {
            value: { _light: "{colors.gray.50}", _dark: "#131417" },
          },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
