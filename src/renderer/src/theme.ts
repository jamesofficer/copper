import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  globalCss: {
    html: {
      colorPalette: "purple",
    },
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
