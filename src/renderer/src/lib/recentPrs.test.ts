import { describe, expect, it } from "vitest";
import { timeAgo } from "./recentPrs";

describe("timeAgo", () => {
  it("counts in minutes, hours and days", () => {
    const now = Date.now();
    expect(timeAgo(new Date(now - 5_000).toISOString())).toBe("just now");
    expect(timeAgo(new Date(now - 90 * 60_000).toISOString())).toBe("1h ago");
    expect(timeAgo(new Date(now - 3 * 86_400_000).toISOString())).toBe(
      "3d ago",
    );
  });

  it("says nothing for a date it can't read", () => {
    // Rows persisted before a date field existed carry none, and "Invalid Date"
    // in the row is worse than no time at all.
    expect(timeAgo(undefined)).toBe("");
    expect(timeAgo("")).toBe("");
    expect(timeAgo("not a date")).toBe("");
  });
});
