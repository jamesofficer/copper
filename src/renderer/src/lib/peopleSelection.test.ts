import { describe, expect, it } from "vitest";
import { peopleOptions, setPersonSelected } from "./peopleSelection";

describe("people selection", () => {
  it("adds and removes a login without duplicates", () => {
    expect(setPersonSelected(["ada"], "linus", true)).toEqual(["ada", "linus"]);
    expect(setPersonSelected(["ada"], "ada", true)).toEqual(["ada"]);
    expect(setPersonSelected(["ada", "linus"], "ada", false)).toEqual([
      "linus",
    ]);
  });

  it("keeps selected people available and excludes blocked logins", () => {
    expect(
      peopleOptions(["grace", "ada", "author"], ["linus"], ["author"]),
    ).toEqual(["ada", "grace", "linus"]);
  });
});
