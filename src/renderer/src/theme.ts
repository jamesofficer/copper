import {
  createSystem,
  defaultConfig,
  defineConfig,
  type SystemStyleObject,
} from "@chakra-ui/react";
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
    // The app's top bars are window drag regions (lib/titleBar.ts), and a drag
    // region swallows clicks on whatever sits inside it — so anything meant to
    // be clicked opts out, wherever it is.
    "button, a, input, textarea, select, [role='button']": {
      "-webkit-app-region": "no-drag",
    } as SystemStyleObject,
  },
  theme: {
    recipes: {
      button: {
        variants: {
          variant: {
            // Outline buttons are the app's secondary actions — toolbars, Cancel,
            // and the like — so they stay neutral instead of inheriting the
            // accent from <html>. A button that means something (yellow, red,
            // green) still sets its own colorPalette, which wins over this.
            outline: { colorPalette: "gray" },
          },
        },
      },
    },
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
