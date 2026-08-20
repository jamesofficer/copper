import type { Worktree } from "../../../../shared/types";
import { QUEUE_TAB_ID, type Tab } from "./tabs";

// The text on a tab, and the text in its tooltip. This file has no React code,
// because the tab bar must decide the icon: an icon is JSX, and this layer
// stays pure. The bar reads `icon` here and selects the picture.

export type TabIcon = "queue" | "pullRequest" | "repoIssues" | "branch";

export interface TabLabel {
  icon: TabIcon;
  // A short code before the text, in the mono font. A pull request tab shows
  // its number here.
  prefix: string | null;
  text: string;
  // The full text, for the tooltip. A tab is narrow, so it truncates the text.
  // The tooltip must give the part that the tab hides.
  tooltip: string;
  // The queue tab has no close button.
  closable: boolean;
}

export function describeTab(tab: Tab): TabLabel {
  if (tab.kind === "queue") {
    return {
      icon: "queue",
      prefix: null,
      text: "Pull Requests",
      tooltip: "Repository pull requests",
      closable: false,
    };
  }
  if (tab.kind === "pr") {
    return {
      icon: "pullRequest",
      prefix: `#${tab.pr.number}`,
      text: tab.pr.title,
      tooltip: `${tab.pr.repo} #${tab.pr.number} — ${tab.pr.title}`,
      closable: true,
    };
  }
  if (tab.kind === "repoIssues") {
    return {
      icon: "repoIssues",
      prefix: tab.repo.name,
      text: "Issues",
      tooltip: `${tab.repo.slug ?? tab.repo.name} — Issues`,
      closable: true,
    };
  }
  return {
    icon: "branch",
    prefix: null,
    text: tab.title,
    // The path, because two worktrees of one repository can have the same
    // text. The path is the only part that is always different.
    tooltip: `Current changes — ${tab.worktreePath}`,
    closable: true,
  };
}

// The tabs that the user can move. The queue tab is always first, so the drag
// code must not receive it.
export function localChangesTitle(
  repoName: string,
  worktree: Worktree,
): string {
  if (worktree.isMain) return repoName;
  const folder = worktree.path.split(/[\\/]/).filter(Boolean).at(-1);
  return `${repoName} (${worktree.branch ?? folder ?? "detached"})`;
}

export function sortableTabIds(tabs: readonly Tab[]): string[] {
  return tabs.filter((tab) => tab.id !== QUEUE_TAB_ID).map((tab) => tab.id);
}
