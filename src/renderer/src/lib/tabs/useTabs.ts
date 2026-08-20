import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PullRequest } from "../../../../shared/types";
import * as tabs from "./tabs";
import {
  initialTabsState,
  type PrTabUi,
  prTabId,
  QUEUE_TAB_ID,
  type ReviewTab,
  type TabsData,
} from "./tabs";

// The tabs store. This file only connects things: every change comes from a
// pure function in tabs.ts, and the tests for those functions are in
// tabs.test.ts. The test for this file checks the connections only.
//
// This store uses Zustand. The settings stores in lib use useSyncExternalStore
// instead (see issue #49). The reason is the selectors: a store that uses
// useSyncExternalStore has one snapshot for all of its data, so each change
// makes every reader render again. That result is acceptable for a setting.
// It is not acceptable here. A pull request tab records the text in the file
// filter. The tab bar must not render again for each key press.

export interface TabsStore extends TabsData {
  // Each function returns the id of the tab that becomes active, if the caller
  // needs it.
  openPullRequest(pr: PullRequest, tab?: ReviewTab): string;
  openLocalChanges(args: {
    repoPath: string;
    worktreePath: string;
    title: string;
  }): string;
  openQueue(): void;
  activateTab(id: string): void;
  activateOffset(delta: number): void;
  activateIndex(index: number): void;
  closeTab(id: string): void;
  closeOthers(id: string): void;
  closeToRight(id: string): void;
  moveTab(id: string, toIndex: number): void;
  setPrUi(id: string, patch: Partial<PrTabUi>): void;
}

export const useTabs = create<TabsStore>()(
  persist(
    (set) => ({
      ...initialTabsState(),

      openPullRequest(pr, tab = "overview") {
        set((state) => tabs.openPullRequest(state, pr, tab));
        return prTabId(pr.repo, pr.number);
      },
      openLocalChanges(args) {
        set((state) => tabs.openLocalChanges(state, args));
        return tabs.localChangesTabId(args.worktreePath);
      },
      openQueue() {
        set((state) => tabs.activateTab(state, QUEUE_TAB_ID));
      },
      activateTab(id) {
        set((state) => tabs.activateTab(state, id));
      },
      activateOffset(delta) {
        set((state) => tabs.activateOffset(state, delta));
      },
      activateIndex(index) {
        set((state) => tabs.activateIndex(state, index));
      },
      closeTab(id) {
        set((state) => tabs.closeTab(state, id));
      },
      closeOthers(id) {
        set((state) => tabs.closeOthers(state, id));
      },
      closeToRight(id) {
        set((state) => tabs.closeToRight(state, id));
      },
      moveTab(id, toIndex) {
        set((state) => tabs.moveTab(state, id, toIndex));
      },
      setPrUi(id, patch) {
        set((state) => tabs.setPrUi(state, id, patch));
      },
    }),
    {
      name: "copper-tabs",
      version: 1,
      // Only the data goes to disk. The app makes the functions again at each
      // start.
      partialize: (state) => ({
        tabs: state.tabs,
        activeId: state.activeId,
        mru: state.mru,
      }),
      // Zustand reads the stored state inside create(), so this function runs
      // before the module is complete. `parse` must come from another module
      // for that reason. Zustand also hides an error here: if this function
      // fails, the app starts with no tabs and shows no message.
      merge: (persisted, current) => ({ ...current, ...tabs.parse(persisted) }),
    },
  ),
);
