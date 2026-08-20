import {
  createSystem,
  defaultConfig,
  defineConfig,
  type SystemStyleObject,
} from "@chakra-ui/react";
import { accentPalettes, defaultAccent } from "./lib/accent";
import { bodyFontSizes, defaultBodyFontSize } from "./lib/bodyFontSize";

// One rule per palette: whichever data-accent <html> carries wins. applyAccent
// in lib/accent.ts sets the attribute; the default covers first paint.
const accentRules = Object.fromEntries(
  accentPalettes.map((palette) => [
    `html[data-accent="${palette}"]`,
    { colorPalette: palette },
  ]),
);

const bodyFontSizeRules = Object.fromEntries(
  bodyFontSizes.map((size) => [
    `html[data-body-font-size="${size}"]`,
    { fontSize: `${size}px` },
  ]),
);

// What the app falls back to before the bundled font is parsed, and for any
// glyph it doesn't carry.
const uiFallback =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const config = defineConfig({
  globalCss: {
    html: {
      colorPalette: defaultAccent,
      fontSize: `${defaultBodyFontSize}px`,
    },
    ...accentRules,
    ...bodyFontSizeRules,
    body: {
      bg: "bg",
      color: "fg",
    },
    // The app's top bars are window drag regions (lib/titleBar.ts), and a drag
    // region swallows clicks on whatever sits inside it — so anything meant to
    // be clicked opts out, wherever it is.
    "button, a, input, textarea, select, [role='button']": {
      // Camel case, like lib/titleBar.ts. Both spellings give the same CSS, but
      // the kebab-case spelling also makes a warning on each render.
      WebkitAppRegion: "no-drag",
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
        // Google Sans Flex, bundled as a variable font
        // (@fontsource-variable/google-sans-flex, weight axis only) — shipped
        // with the app rather than fetched from Google, since the renderer's
        // CSP allows no outside connections and a desktop app shouldn't wait on
        // a font CDN to paint. The system stack stays behind it for the glyphs
        // its subsets don't cover.
        heading: { value: `'Google Sans Flex Variable', ${uiFallback}` },
        body: { value: `'Google Sans Flex Variable', ${uiFallback}` },
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
