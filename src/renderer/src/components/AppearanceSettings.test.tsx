import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "../testing/render";
import AppearanceSettings from "./AppearanceSettings";

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.bodyFontSize;
});

describe("AppearanceSettings", () => {
  it("changes the body font size", async () => {
    renderWithProviders(<AppearanceSettings />);

    expect(screen.getByText("Text size")).toBeTruthy();
    await userEvent.click(screen.getByRole("combobox", { name: "Text size" }));
    await userEvent.click(
      screen.getByRole("option", { name: "Large — 18 px" }),
    );

    expect(document.documentElement.dataset.bodyFontSize).toBe("18");
  });
});
