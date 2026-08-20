import { describe, expect, it } from "vitest";
import type { PullRequest } from "../../../../shared/types";
import { describeTab, localChangesTitle, sortableTabIds } from "./tabLabel";
import {
  defaultPrTabUi,
  defaultRepoIssuesTabUi,
  localChangesTabId,
  prTabId,
  QUEUE_TAB_ID,
  repoIssuesTabId,
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

const issuesTab: Tab = {
  id: repoIssuesTabId("/r"),
  kind: "repoIssues",
  repo: { path: "/r", name: "app", slug: "acme/app" },
  ui: defaultRepoIssuesTabUi(),
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

    expect(label.text).toBe("Pull Requests");
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

  it("names an issues tab by repository", () => {
    const label = describeTab(issuesTab);

    expect(label.prefix).toBe("app");
    expect(label.text).toBe("Issues");
    expect(label.tooltip).toBe("acme/app — Issues");
    expect(label.icon).toBe("repoIssues");
    expect(label.closable).toBe(true);
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

describe("localChangesTitle", () => {
  it("uses the repository name for the main worktree", () => {
    expect(
      localChangesTitle("app", {
        path: "/r",
        branch: "main",
        isMain: true,
      }),
    ).toBe("app");
  });

  it("identifies a linked worktree by branch or folder", () => {
    expect(
      localChangesTitle("app", {
        path: "/r/feature",
        branch: "feat/tabs",
        isMain: false,
      }),
    ).toBe("app (feat/tabs)");
    expect(
      localChangesTitle("app", {
        path: "C:\\worktrees\\detached",
        branch: null,
        isMain: false,
      }),
    ).toBe("app (detached)");
  });
});

describe("sortableTabIds", () => {
  it("does not give the queue tab to the drag code", () => {
    expect(sortableTabIds([queueTab, prTab, issuesTab, localTab])).toEqual([
      prTab.id,
      issuesTab.id,
      localTab.id,
    ]);
  });

  it("gives an empty list when the queue tab is the only tab", () => {
    expect(sortableTabIds([queueTab])).toEqual([]);
  });
});
