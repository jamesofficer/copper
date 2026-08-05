import { describe, expect, it } from "vitest";
import { syntaxBackground } from "./syntaxColors";
import { findSyntaxTheme } from "./syntaxThemeCatalog";

describe("syntaxBackground", () => {
  // The diff surface paints the selected theme's own canvas; a swap here
  // (dark rule reading the light theme, or vice versa) would give the diff
  // the wrong background in one of the modes.
  it("maps each mode's rule to that mode's theme background", () => {
    const rules = syntaxBackground({
      dark: "tokyo-night",
      light: "kanagawa-lotus",
    });

    expect(rules[".dark &"].backgroundColor).toBe(
      findSyntaxTheme("tokyo-night")?.bg,
    );
    expect(rules[".light &"].backgroundColor).toBe(
      findSyntaxTheme("kanagawa-lotus")?.bg,
    );
    expect(rules[".dark &"].backgroundColor).toBeTruthy();
    expect(rules[".light &"].backgroundColor).toBeTruthy();
  });

  // Markdown scopes the background to its code blocks — the selector must
  // land inside the mode rule, not replace it, or the wrong mode's canvas
  // would apply to every block.
  it("scopes a descendant selector inside each mode rule", () => {
    const rules = syntaxBackground(
      { dark: "tokyo-night", light: "kanagawa-lotus" },
      "& pre",
    );

    expect(rules[".dark & pre"].backgroundColor).toBe(
      findSyntaxTheme("tokyo-night")?.bg,
    );
    expect(rules[".light & pre"].backgroundColor).toBe(
      findSyntaxTheme("kanagawa-lotus")?.bg,
    );
  });
});
