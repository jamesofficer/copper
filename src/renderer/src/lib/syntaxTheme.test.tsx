import { beforeEach, describe, expect, it, vi } from "vitest";

// The store reads localStorage once at module scope, the same way
// diffViewMode.ts does, so a case that starts from different stored values
// needs a fresh module instance rather than the one the last case mutated.
async function loadStore() {
  vi.resetModules();
  return import("./syntaxTheme");
}

beforeEach(() => {
  localStorage.clear();
});

describe("getSyntaxThemes", () => {
  it("defaults to the GitHub pair when nothing has been chosen", async () => {
    const { getSyntaxThemes } = await loadStore();

    expect(getSyntaxThemes()).toEqual({
      dark: "github-dark",
      light: "github-light",
    });
  });

  it("restores both stored themes", async () => {
    localStorage.setItem("syntaxThemeDark", "dracula");
    localStorage.setItem("syntaxThemeLight", "one-light");
    const { getSyntaxThemes } = await loadStore();

    expect(getSyntaxThemes()).toEqual({ dark: "dracula", light: "one-light" });
  });

  // A Shiki upgrade can drop a theme id. Only the mode that lost its theme
  // should fall back — resetting the whole pair would throw away a choice the
  // user made and that still works.
  it("falls back for one mode without discarding the other", async () => {
    localStorage.setItem("syntaxThemeDark", "theme-that-was-removed");
    localStorage.setItem("syntaxThemeLight", "one-light");
    const { getSyntaxThemes } = await loadStore();

    expect(getSyntaxThemes()).toEqual({
      dark: "github-dark",
      light: "one-light",
    });
  });

  // useSyncExternalStore compares snapshots by reference and re-renders in a
  // loop if getSnapshot returns a new object every time it is called.
  it("returns the same snapshot until a theme actually changes", async () => {
    const { getSyntaxThemes, setSyntaxTheme } = await loadStore();
    const first = getSyntaxThemes();

    expect(getSyntaxThemes()).toBe(first);

    setSyntaxTheme("dark", "nord");
    expect(getSyntaxThemes()).not.toBe(first);
  });
});

describe("setSyntaxTheme", () => {
  it("persists the choice and tells subscribers", async () => {
    const { getSyntaxThemes, setSyntaxTheme, subscribeToSyntaxThemes } =
      await loadStore();
    const listener = vi.fn();
    subscribeToSyntaxThemes(listener);

    setSyntaxTheme("dark", "nord");

    expect(getSyntaxThemes().dark).toBe("nord");
    expect(localStorage.getItem("syntaxThemeDark")).toBe("nord");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("leaves the other mode's theme alone", async () => {
    const { getSyntaxThemes, setSyntaxTheme } = await loadStore();

    setSyntaxTheme("light", "solarized-light");

    expect(getSyntaxThemes()).toEqual({
      dark: "github-dark",
      light: "solarized-light",
    });
  });

  // Unsubscribing has to actually detach: every mounted diff subscribes, so a
  // leak here means unmounted diffs are still notified on every theme change.
  it("stops notifying a listener that unsubscribed", async () => {
    const { setSyntaxTheme, subscribeToSyntaxThemes } = await loadStore();
    const listener = vi.fn();
    subscribeToSyntaxThemes(listener)();

    setSyntaxTheme("dark", "nord");

    expect(listener).not.toHaveBeenCalled();
  });
});
