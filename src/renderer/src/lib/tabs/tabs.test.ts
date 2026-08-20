import { describe, expect, it } from "vitest";
import type { PullRequest } from "../../../../shared/types";
import {
  activateIndex,
  activateOffset,
  activateTab,
  closeOthers,
  closeTab,
  closeToRight,
  initialTabsState,
  localChangesTabId,
  moveTab,
  openLocalChanges,
  openPullRequest,
  parse,
  pickLiveTabIds,
  prTabId,
  QUEUE_TAB_ID,
  setPrUi,
  type TabsData,
  tabMenuAvailability,
} from "./tabs";

function pr(number: number, repo = "acme/app"): PullRequest {
  return {
    repo,
    number,
    title: `PR ${number}`,
    author: "octocat",
    draft: false,
    reviewStatus: "awaiting_review",
    headSha: "abc123",
    url: `https://github.com/${repo}/pull/${number}`,
    additions: 1,
    deletions: 0,
    changedFiles: 1,
    comments: 0,
    assignees: [],
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  };
}

// Opens the given pull request numbers in order, from an empty state.
function withPrs(...numbers: number[]): TabsData {
  return numbers.reduce(
    (state, number) => openPullRequest(state, pr(number)),
    initialTabsState(),
  );
}

const ids = (state: TabsData) => state.tabs.map((tab) => tab.id);
const first = prTabId("acme/app", 1);
const second = prTabId("acme/app", 2);

describe("opening tabs", () => {
  it("starts with the queue tab only, and makes it active", () => {
    const state = initialTabsState();

    expect(ids(state)).toEqual([QUEUE_TAB_ID]);
    expect(state.activeId).toBe(QUEUE_TAB_ID);
  });

  it("opens a pull request in a new tab and makes it active", () => {
    const state = openPullRequest(initialTabsState(), pr(1), "changes");

    expect(ids(state)).toEqual([QUEUE_TAB_ID, first]);
    expect(state.activeId).toBe(first);
  });

  it("finds an open pull request again instead of making a second tab", () => {
    const state = openPullRequest(withPrs(1, 2), pr(1));

    expect(ids(state)).toEqual([QUEUE_TAB_ID, first, second]);
    expect(state.activeId).toBe(first);
  });

  it("shows the pane that the caller asks for", () => {
    // A user who clicks "Review changes" on an open pull request wants the
    // diff. The app must not show the pane that the user left before.
    const left = setPrUi(withPrs(1), first, { tab: "review" });
    const state = openPullRequest(left, pr(1), "changes");

    const tab = state.tabs.find((entry) => entry.id === first);
    expect(tab?.kind === "pr" && tab.ui.tab).toBe("changes");
  });

  it("separates the same number in two repositories", () => {
    let state = openPullRequest(initialTabsState(), pr(1, "acme/app"));
    state = openPullRequest(state, pr(1, "acme/web"));

    expect(state.tabs).toHaveLength(3);
  });

  it("gives each worktree its own tab", () => {
    let state = openLocalChanges(initialTabsState(), {
      repoPath: "/r",
      worktreePath: "/r",
      title: "app",
    });
    state = openLocalChanges(state, {
      repoPath: "/r",
      worktreePath: "/r/wt",
      title: "app (feature)",
    });
    state = openLocalChanges(state, {
      repoPath: "/r",
      worktreePath: "/r",
      title: "app",
    });

    expect(ids(state)).toEqual([
      QUEUE_TAB_ID,
      localChangesTabId("/r"),
      localChangesTabId("/r/wt"),
    ]);
    expect(state.activeId).toBe(localChangesTabId("/r"));
  });
});

describe("closing tabs", () => {
  it("keeps the queue tab", () => {
    const state = closeTab(initialTabsState(), QUEUE_TAB_ID);

    expect(ids(state)).toEqual([QUEUE_TAB_ID]);
  });

  it("makes the tab on the right active", () => {
    const state = closeTab(activateTab(withPrs(1, 2), first), first);

    expect(state.activeId).toBe(second);
  });

  it("makes the tab on the left active at the end of the row", () => {
    const state = closeTab(withPrs(1, 2), second);
    expect(state.activeId).toBe(first);

    expect(closeTab(state, first).activeId).toBe(QUEUE_TAB_ID);
  });

  it("does not change the active tab when it closes a different tab", () => {
    const state = closeTab(withPrs(1, 2), first);

    expect(state.activeId).toBe(second);
  });

  it("removes a closed tab from the order, so it cannot stay in the DOM", () => {
    const state = closeTab(withPrs(1, 2), first);

    expect(state.mru).not.toContain(first);
  });

  it("closes the other tabs but keeps the queue tab", () => {
    const state = closeOthers(withPrs(1, 2, 3), second);

    expect(ids(state)).toEqual([QUEUE_TAB_ID, second]);
    expect(state.activeId).toBe(second);
    expect(state.mru).toEqual([second, QUEUE_TAB_ID]);
  });

  it("closes every tab to the right", () => {
    const state = closeToRight(withPrs(1, 2, 3), first);

    expect(ids(state)).toEqual([QUEUE_TAB_ID, first]);
    expect(state.activeId).toBe(first);
    expect(state.mru).toEqual([first, QUEUE_TAB_ID]);
  });

  it("keeps the active tab when it is left of the closed tabs", () => {
    const state = closeToRight(
      activateTab(withPrs(1, 2, 3), QUEUE_TAB_ID),
      second,
    );

    expect(ids(state)).toEqual([QUEUE_TAB_ID, first, second]);
    expect(state.activeId).toBe(QUEUE_TAB_ID);
  });

  it("does nothing when no tab is to the right", () => {
    const state = withPrs(1, 2);

    expect(closeToRight(state, second)).toBe(state);
  });
});

describe("tab context menu", () => {
  it("offers actions that can change the selected tab row", () => {
    const tabs = withPrs(1, 2).tabs;

    expect(tabMenuAvailability(tabs, QUEUE_TAB_ID)).toEqual({
      canClose: false,
      canCloseOthers: true,
      canCloseToRight: true,
    });
    expect(tabMenuAvailability(tabs, first)).toEqual({
      canClose: true,
      canCloseOthers: true,
      canCloseToRight: true,
    });
    expect(tabMenuAvailability(tabs, second)).toEqual({
      canClose: true,
      canCloseOthers: true,
      canCloseToRight: false,
    });
  });

  it("disables actions that cannot change a row with one tab", () => {
    expect(tabMenuAvailability(initialTabsState().tabs, QUEUE_TAB_ID)).toEqual({
      canClose: false,
      canCloseOthers: false,
      canCloseToRight: false,
    });
  });
});

describe("selecting tabs", () => {
  it("ignores an id that is not open", () => {
    const state = activateTab(initialTabsState(), "pr:acme/app#404");

    expect(state.activeId).toBe(QUEUE_TAB_ID);
  });

  it("continues from each end of the row", () => {
    const state = withPrs(1, 2);

    expect(activateOffset(state, 1).activeId).toBe(QUEUE_TAB_ID);
    expect(activateOffset(activateTab(state, first), -1).activeId).toBe(
      QUEUE_TAB_ID,
    );
    expect(activateOffset(activateTab(state, QUEUE_TAB_ID), -1).activeId).toBe(
      second,
    );
  });

  it("counts from the queue tab, and stops at the last tab", () => {
    // Cmd+1 selects the queue tab. Cmd+9 selects the last tab.
    const state = withPrs(1, 2);

    expect(activateIndex(state, 0).activeId).toBe(QUEUE_TAB_ID);
    expect(activateIndex(state, 1).activeId).toBe(first);
    expect(activateIndex(state, 8).activeId).toBe(second);
  });
});

describe("moving tabs", () => {
  it("moves a tab to a new position", () => {
    const state = moveTab(withPrs(1, 2), first, 2);

    expect(ids(state)).toEqual([QUEUE_TAB_ID, second, first]);
  });

  it("keeps the queue tab first", () => {
    const state = withPrs(1, 2);

    expect(ids(moveTab(state, second, 0))).toEqual([
      QUEUE_TAB_ID,
      second,
      first,
    ]);
    expect(ids(moveTab(state, QUEUE_TAB_ID, 2))[0]).toBe(QUEUE_TAB_ID);
  });
});

describe("the state of one tab", () => {
  it("changes one tab and keeps the other tabs", () => {
    const state = setPrUi(withPrs(1, 2), first, {
      fileFilter: "src/",
      tab: "changes",
    });

    const a = state.tabs.find((tab) => tab.id === first);
    const b = state.tabs.find((tab) => tab.id === second);
    expect(a?.kind === "pr" && a.ui.fileFilter).toBe("src/");
    expect(a?.kind === "pr" && a.ui.selectedPath).toBeNull();
    expect(b?.kind === "pr" && b.ui.fileFilter).toBe("");
  });

  it("makes no change to a tab that is not a pull request", () => {
    const state = setPrUi(initialTabsState(), QUEUE_TAB_ID, {
      fileFilter: "x",
    });

    expect(state.tabs[0]).toEqual({ id: QUEUE_TAB_ID, kind: "queue" });
  });
});

describe("pickLiveTabIds", () => {
  it("keeps the active tab, then the most recent tabs, up to the limit", () => {
    expect(pickLiveTabIds(["b", "a", "c", "d"], "b", 3)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("keeps the active tab when the order does not contain it", () => {
    expect(pickLiveTabIds(["a", "b"], "z", 2)).toEqual(["z", "a"]);
  });

  it("gives each tab one position only", () => {
    expect(pickLiveTabIds(["a", "a", "b"], "a", 3)).toEqual(["a", "b"]);
  });
});

describe("reading the stored tabs", () => {
  const prTab = {
    id: first,
    kind: "pr",
    pr: { repo: "acme/app", number: 1, title: "PR 1" },
    ui: {
      tab: "changes",
      selectedPath: "a.ts",
      selectedCommit: null,
      fileFilter: "",
      chatCollapsed: false,
    },
  };

  it("reads the tabs, the active tab and the order", () => {
    const state = parse({
      tabs: [prTab],
      activeId: first,
      mru: [first, QUEUE_TAB_ID],
    });

    expect(ids(state)).toEqual([QUEUE_TAB_ID, first]);
    expect(state.activeId).toBe(first);
    expect(state.mru).toEqual([first, QUEUE_TAB_ID]);
  });

  it("puts the queue tab first, and puts it there one time only", () => {
    const state = parse({
      tabs: [prTab, { id: QUEUE_TAB_ID, kind: "queue" }],
      activeId: QUEUE_TAB_ID,
      mru: [],
    });

    expect(ids(state)).toEqual([QUEUE_TAB_ID, first]);
  });

  it("removes a tab that it cannot read and keeps the other tabs", () => {
    // The loss of one tab is better than the loss of all of the tabs.
    const state = parse({
      tabs: [{ kind: "pr", pr: { repo: 12 } }, null, "nonsense", prTab],
      activeId: first,
      mru: [],
    });

    expect(ids(state)).toEqual([QUEUE_TAB_ID, first]);
  });

  it("selects the queue tab when the active tab is not present", () => {
    const state = parse({ tabs: [], activeId: "pr:acme/app#99", mru: [] });

    expect(state.activeId).toBe(QUEUE_TAB_ID);
  });

  it("gives a tab a place in the order when the order has none", () => {
    // Without a place in the order, the tab can never stay in the DOM.
    const state = parse({ tabs: [prTab], activeId: QUEUE_TAB_ID, mru: [] });

    expect(state.mru).toContain(first);
    expect(state.mru[0]).toBe(QUEUE_TAB_ID);
  });

  it("keeps a tab that has new fields in its pull request data", () => {
    // The app reads this data only to show the tab. A check of all of the
    // fields would remove the tab after someone adds a new field.
    const state = parse({
      tabs: [{ ...prTab, pr: { ...prTab.pr, somethingNew: true } }],
      activeId: QUEUE_TAB_ID,
      mru: [],
    });

    expect(state.tabs).toHaveLength(2);
  });

  it("gives the initial state for data that it cannot read", () => {
    expect(parse(undefined).tabs).toHaveLength(1);
    expect(parse("nope").activeId).toBe(QUEUE_TAB_ID);
    expect(parse({ tabs: "not an array" }).tabs).toHaveLength(1);
  });
});
