import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../testing/render";
import Markdown from "./Markdown";

describe("Markdown", () => {
  it("uses the medium text size for body prose", () => {
    renderWithProviders(<Markdown>Body text</Markdown>);

    const prose = screen.getByText("Body text").parentElement;
    expect(prose).not.toBeNull();
    expect(getComputedStyle(prose as HTMLElement).fontSize).toBe(
      "var(--chakra-font-sizes-md)",
    );
  });
});
