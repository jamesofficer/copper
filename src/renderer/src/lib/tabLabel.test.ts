import { describe, expect, it } from "vitest";
import type { PullRequest } from "../../../shared/types";
import { describeTab, sortableTabIds } from "./tabLabel";
import {
  defaultPrTabUi,
  localChangesTabId,
  prTabId,
  QUEUE_TAB_ID,
  type Tab,
} from "./tabs";

const pr = {
  repo: "acme/app",
  number: 42,
  title: "Add the tab bar",
} as PullRequest;

const prTab: Tab = {
  id: prTabId("acme/app", 42),
  kind: "pr",
  pr,
  ui: defaultPrTabUi(),
};

const localTab: Tab = {
  id: localChangesTabId("/r/wt"),
  kind: "localChanges",
  repoPath: "/r",
  worktreePath: "/r/wt",
  title: "app (feature)",
};

const queueTab: Tab = { id: QUEUE_TAB_ID, kind: "queue" };

describe("describeTab", () => {
  it("gives the queue tab a name and no close button", () => {
    const label = describeTab(queueTab);

    expect(label.text).toBe("Queue");
    expect(label.closable).toBe(false);
    expect(label.icon).toBe("queue");
  });

  it("shows the number and the title of a pull request", () => {
    const label = describeTab(prTab);

    expect(label.prefix).toBe("#42");
    expect(label.text).toBe("Add the tab bar");
    expect(label.icon).toBe("pullRequest");
    expect(label.closable).toBe(true);
  });

  it("names the repository in the tooltip of a pull request", () => {
    // The tab is narrow and shows no repository. A user with two repositories
    // open needs the tooltip to tell the tabs apart.
    expect(describeTab(prTab).tooltip).toBe("acme/app #42 — Add the tab bar");
  });

  it("gives the path of a worktree in the tooltip", () => {
    // Two worktrees of one repository can have the same text on the tab. The
    // path is the only part that is always different.
    const label = describeTab(localTab);

    expect(label.text).toBe("app (feature)");
    expect(label.tooltip).toBe("Current changes — /r/wt");
    expect(label.icon).toBe("branch");
    expect(label.closable).toBe(true);
  });
});

describe("sortableTabIds", () => {
  it("does not give the queue tab to the drag code", () => {
    expect(sortableTabIds([queueTab, prTab, localTab])).toEqual([
      prTab.id,
      localTab.id,
    ]);
  });

  it("gives an empty list when the queue tab is the only tab", () => {
    expect(sortableTabIds([queueTab])).toEqual([]);
  });
});
