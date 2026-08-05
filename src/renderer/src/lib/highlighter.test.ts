import { describe, expect, it } from "vitest";
import { highlightToLines } from "./highlighter";
import { defaultSyntaxThemeIds } from "./syntaxThemeCatalog";

const CODE = "const answer = 42;";

function html(dark: string, light: string): string {
  return (highlightToLines(CODE, "typescript", { dark, light }) ?? []).join("");
}

describe("highlightToLines", () => {
  // The whole point of the setting: the theme pair the caller passes is the
  // one the tokens are coloured with, not a hard-coded pair.
  it("colours the same code differently under two theme pairs", () => {
    const github = html("github-dark", "github-light");
    const dracula = html("dracula", "one-light");

    expect(github).not.toBe(dracula);
  });

  // defaultColor: false emits both modes' colours as CSS variables, which is
  // what lets a light/dark switch be a pure CSS swap with no re-highlight.
  // Lose this and every diff would have to re-tokenise on every mode toggle.
  it("emits a colour for both modes on every token", () => {
    const output = html("dracula", "one-light");

    expect(output).toContain("--shiki-dark:");
    expect(output).toContain("--shiki-light:");
  });

  // A stored theme id can outlive the theme itself across a Shiki upgrade.
  // Highlighting is called per hunk during render, so throwing here would
  // take out the whole Changes tab rather than one line of colour.
  it("falls back to the default theme when a theme is unknown", () => {
    const missing = html("theme-that-was-removed", "one-light");

    expect(missing).toBe(html(defaultSyntaxThemeIds.dark, "one-light"));
  });

  it("returns null for a language the highlighter does not know", () => {
    expect(
      highlightToLines(CODE, "not-a-language", defaultSyntaxThemeIds),
    ).toBeNull();
  });
});
