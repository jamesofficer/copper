import { describe, expect, it } from "vitest";
import {
  defaultSyntaxThemeIds,
  findSyntaxTheme,
  resolveSyntaxThemeId,
  syntaxThemes,
  syntaxThemesFor,
} from "./syntaxThemeCatalog";

describe("syntaxThemes", () => {
  // The catalogue is one static import per theme. A copy-paste in that block
  // would list a theme twice, which React renders as duplicate <Select.Item>
  // keys and the user reads as a picker with mysterious repeats.
  it("lists every theme exactly once", () => {
    const ids = syntaxThemes.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Both are derived from the theme's own metadata rather than hand-written,
  // so an empty one means we read the wrong field off the registration.
  it("gives every theme a label and an appearance", () => {
    for (const theme of syntaxThemes) {
      expect(theme.label, theme.id).not.toBe("");
      expect(["light", "dark"], theme.id).toContain(theme.appearance);
    }
  });

  // Raw shiki registrations have no top-level bg/fg — the colours sit in the
  // VS Code colour map. Reading the wrong field paints every preview and
  // swatch black, which for a light theme is exactly wrong.
  it("reads each theme's own background, not a black fallback", () => {
    expect(findSyntaxTheme("light-plus")?.bg.toLowerCase()).toBe("#ffffff");
    expect(findSyntaxTheme("github-dark")?.bg.toLowerCase()).not.toBe(
      "#ffffff",
    );
    const black = syntaxThemesFor("light").filter(
      (theme) => theme.bg === "#000000",
    );
    expect(black.map((theme) => theme.id)).toEqual([]);
  });
});

describe("syntaxThemesFor", () => {
  // Each picker only offers themes for its own mode, so an empty group would
  // be a picker with nothing in it.
  it("groups themes by appearance, leaving neither group empty", () => {
    const dark = syntaxThemesFor("dark");
    const light = syntaxThemesFor("light");

    expect(dark.length).toBeGreaterThan(0);
    expect(light.length).toBeGreaterThan(0);
    expect(dark.every((theme) => theme.appearance === "dark")).toBe(true);
    expect(light.every((theme) => theme.appearance === "light")).toBe(true);
    expect(dark.length + light.length).toBe(syntaxThemes.length);
  });
});

describe("defaultSyntaxThemeIds", () => {
  // The defaults are what every existing user keeps seeing after this feature
  // ships; a typo here silently changes the app's look for everyone.
  it("names themes that exist, each matching its own mode", () => {
    expect(findSyntaxTheme(defaultSyntaxThemeIds.dark)?.appearance).toBe(
      "dark",
    );
    expect(findSyntaxTheme(defaultSyntaxThemeIds.light)?.appearance).toBe(
      "light",
    );
  });
});

describe("resolveSyntaxThemeId", () => {
  it("keeps an id the catalogue knows", () => {
    expect(resolveSyntaxThemeId("dracula", "dark")).toBe("dracula");
  });

  // A Shiki upgrade can rename or drop a theme. The stored id then names
  // nothing, and highlighting must not throw on a whole tab of diffs.
  it("falls back to the mode's default when the id is unknown", () => {
    expect(resolveSyntaxThemeId("theme-that-was-removed", "dark")).toBe(
      defaultSyntaxThemeIds.dark,
    );
    expect(resolveSyntaxThemeId(null, "light")).toBe(
      defaultSyntaxThemeIds.light,
    );
  });
});
