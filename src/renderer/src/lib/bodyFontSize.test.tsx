import { beforeEach, describe, expect, it } from "vitest";
import {
  applyBodyFontSize,
  defaultBodyFontSize,
  getBodyFontSize,
} from "./bodyFontSize";

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.bodyFontSize;
});

describe("body font size", () => {
  it("uses the default when the stored value is invalid", () => {
    localStorage.setItem("bodyFontSize", "17");

    expect(getBodyFontSize()).toBe(defaultBodyFontSize);
  });

  it("stores and applies a supported size", () => {
    applyBodyFontSize(18);

    expect(getBodyFontSize()).toBe(18);
    expect(document.documentElement.dataset.bodyFontSize).toBe("18");
  });
});
