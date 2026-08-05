import { act } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setSyntaxTheme } from "../lib/syntaxTheme";
import { defaultSyntaxThemeIds } from "../lib/syntaxThemeCatalog";
import { renderWithProviders } from "../testing/render";
import FileView from "./FileView";

afterEach(() => {
  setSyntaxTheme("dark", defaultSyntaxThemeIds.dark);
  localStorage.clear();
});

describe("FileView", () => {
  // The syntax theme is global state, not a prop, so nothing in the type
  // system forces a highlighting component to subscribe to it. Miss the
  // subscription (or leave the theme out of the memo's dependencies) and the
  // setting silently does nothing until the component happens to remount.
  // FileView stands in for every highlighting surface here; the wiring is the
  // same in DiffLines, Markdown, and ReviewThreadCard.
  it("re-highlights when the syntax theme changes", () => {
    const { container } = renderWithProviders(
      <FileView path="answer.ts" text="const answer = 42;" />,
    );
    const before = container.innerHTML;

    act(() => {
      setSyntaxTheme("dark", "dracula");
    });

    expect(container.innerHTML).not.toBe(before);
  });

  it("keeps the file's text intact across a theme change", () => {
    const { container } = renderWithProviders(
      <FileView path="answer.ts" text="const answer = 42;" />,
    );

    act(() => {
      setSyntaxTheme("dark", "dracula");
    });

    expect(container.textContent).toContain("const answer = 42;");
  });
});
