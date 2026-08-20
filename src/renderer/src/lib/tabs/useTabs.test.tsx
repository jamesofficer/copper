import { beforeEach, describe, expect, it } from "vitest";
import { initialTabsState, prTabId, QUEUE_TAB_ID } from "./tabs";
import { useTabs } from "./useTabs";

// A .tsx file, so that vitest gives it a DOM: the store writes to
// localStorage, and the node environment has none. Nothing here renders a
// component.
//
// tabs.test.ts holds the tests for the behaviour. These tests check the
// connections only: the store must call the pure functions, and it must read
// the stored tabs at start.

const prTab = {
  id: prTabId("acme/app", 1),
  kind: "pr",
  pr: { repo: "acme/app", number: 1, title: "PR 1" },
  ui: {
    tab: "changes",
    selectedPath: null,
    selectedCommit: null,
    fileFilter: "",
    chatCollapsed: false,
  },
};

beforeEach(() => {
  localStorage.clear();
  useTabs.setState(initialTabsState());
});

describe("the tabs store", () => {
  it("connects an action to the pure function, and gives the id", () => {
    const id = useTabs.getState().openPullRequest(
      {
        repo: "acme/app",
        number: 1,
        title: "PR 1",
        author: "octocat",
        draft: false,
        reviewStatus: "awaiting_review",
        headSha: "abc123",
        url: "https://github.com/acme/app/pull/1",
        additions: 1,
        deletions: 0,
        changedFiles: 1,
        comments: 0,
        assignees: [],
        createdAt: "2026-07-01T00:00:00Z",
        updatedAt: "2026-07-01T00:00:00Z",
      },
      "changes",
    );

    expect(id).toBe(prTab.id);
    expect(useTabs.getState().tabs.map((tab) => tab.id)).toEqual([
      QUEUE_TAB_ID,
      prTab.id,
    ]);
    expect(useTabs.getState().activeId).toBe(prTab.id);
  });

  it("writes the tabs to disk, and keeps the actions out of the file", () => {
    useTabs.getState().openQueue();
    const stored = JSON.parse(localStorage.getItem("copper-tabs") ?? "{}");

    expect(Object.keys(stored.state).sort()).toEqual([
      "activeId",
      "mru",
      "tabs",
    ]);
    expect(stored.version).toBe(1);
  });

  it("reads the stored tabs at start", async () => {
    // Zustand reads the stored state inside create(), so `merge` runs before
    // the module is complete. `parse` came from the same module before, and it
    // was not ready at that moment. Zustand hides that error: every tab
    // disappeared and the app gave no message. A test of `parse` alone cannot
    // find this fault. The test must read the state through the store.
    localStorage.setItem(
      "copper-tabs",
      JSON.stringify({
        version: 1,
        state: { tabs: [prTab], activeId: prTab.id, mru: [prTab.id] },
      }),
    );
    await useTabs.persist.rehydrate();

    expect(useTabs.getState().tabs.map((tab) => tab.id)).toEqual([
      QUEUE_TAB_ID,
      prTab.id,
    ]);
    expect(useTabs.getState().activeId).toBe(prTab.id);
  });
});
