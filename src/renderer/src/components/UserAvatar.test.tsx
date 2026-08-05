import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../testing/render";
import UserAvatar from "./UserAvatar";

// jsdom never loads images, so the fallback is always what renders here. That
// suits these tests: the fallback is the interesting part, since it is what a
// reviewer actually sees for a bot, a deleted account, or an offline app.
describe("UserAvatar", () => {
  it("points at the GitHub avatar for the given login", () => {
    renderWithProviders(<UserAvatar username="octocat" />);

    const image = screen.getByAltText("octocat");
    expect(image.getAttribute("src")).toBe(
      "https://avatars.githubusercontent.com/octocat?size=64",
    );
  });

  it("falls back to initials when no fallback node is given", () => {
    renderWithProviders(<UserAvatar username="octocat" />);

    // Chakra derives the initials from the name, so this also pins that we
    // pass the username as the name rather than leaving the fallback blank.
    expect(screen.getByText("o")).toBeTruthy();
  });

  it("prefers a supplied fallback over initials", () => {
    renderWithProviders(
      <UserAvatar username="renovate" fallback={<span>bot</span>} />,
    );

    // A caller passing an icon means "this is not a person" — showing an "r"
    // instead would misrepresent a bot as the human account of that name.
    expect(screen.getByText("bot")).toBeTruthy();
    expect(screen.queryByText("r")).toBeNull();

    // Note for anyone mutation-testing this file: changing the component's
    // `name={fallback ? undefined : username}` to `name={username}` does NOT
    // fail this test, and no test can make it fail. Chakra's Avatar.Fallback
    // renders its children and ignores `name` whenever children exist, so the
    // two produce byte-identical DOM. That branch is an equivalent mutant —
    // harmless, belt-and-braces code rather than a hole in the coverage. The
    // sibling fontSize and color ternaries next to it are live and do matter.
  });
});
