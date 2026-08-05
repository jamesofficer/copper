import { describe, expect, it } from "vitest";
import { isRateLimitMessage, RATE_LIMIT_MESSAGE } from "./rateLimit";

describe("isRateLimitMessage", () => {
  it("matches the message the main process throws", () => {
    expect(isRateLimitMessage(RATE_LIMIT_MESSAGE)).toBe(true);
  });

  // The hyphen is the whole reason this helper is shared rather than inlined on
  // both sides: our own wording is "rate-limiting", GitHub's prose is "rate
  // limit", and the renderer has to recognise either.
  it.each([
    ["GitHub is rate-limiting this app. Wait a minute, then try again.", true],
    ["GitHub: You have exceeded a secondary rate limit.", true],
    ["GitHub: API rate limit exceeded", true],
    ["GITHUB: SECONDARY RATE LIMIT", true],
    ["GitHub: Could not resolve to a Repository", false],
    ["GitHub returned status 500.", false],
    ["", false],
  ])("%j -> %s", (message, expected) => {
    expect(isRateLimitMessage(message)).toBe(expected);
  });

  it("tolerates an undefined message", () => {
    expect(isRateLimitMessage(undefined)).toBe(false);
  });
});
