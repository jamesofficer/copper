import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PullRequest } from "../../../../shared/types";
import { setSidebarCollapsed } from "../../lib/sidebarCollapsed";
import { initialTabsState, prTabId, QUEUE_TAB_ID } from "../../lib/tabs/tabs";
import { useTabs } from "../../lib/tabs/useTabs";
import { renderWithProviders } from "../../testing/render";
import TabBar from "./TabBar";

vi.mock("../../lib/titleBar", () => ({
  dragRegion: {},
  noDragRegion: {},
  titleBarHeight: "12",
  trafficLightSpace: "88px",
}));

// The logic is in lib/tabs/, and those files have their own tests. These
// tests check the connections only: the bar must show the tabs, and its
// controls must call the store.

function pr(number: number, title: string): PullRequest {
  return {
    repo: "acme/app",
    number,
    title,
    author: "octocat",
    draft: false,
    reviewStatus: "awaiting_review",
    headSha: "abc123",
    url: `https://github.com/acme/app/pull/${number}`,
    additions: 1,
    deletions: 0,
    changedFiles: 1,
    comments: 0,
    assignees: [],
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  };
}

const first = prTabId("acme/app", 1);
const second = prTabId("acme/app", 2);

beforeEach(() => {
  localStorage.clear();
  setSidebarCollapsed(false);
  useTabs.setState(initialTabsState());
});

describe("TabBar", () => {
  it("shows the queue tab and every open tab", () => {
    useTabs.getState().openPullRequest(pr(1, "Add the tab bar"));
    useTabs.getState().openPullRequest(pr(2, "Fix the diff"));
    renderWithProviders(<TabBar />);

    expect(screen.getByText("Pull Requests")).toBeTruthy();
    expect(screen.getByText("Add the tab bar")).toBeTruthy();
    expect(screen.getByText("Fix the diff")).toBeTruthy();
    expect(screen.getByText("#1")).toBeTruthy();
  });

  it("keeps collapsed tabs clear of the macOS traffic lights", () => {
    setSidebarCollapsed(true);
    renderWithProviders(<TabBar />);

    expect(getComputedStyle(screen.getByRole("banner")).paddingLeft).toBe(
      "88px",
    );
  });

  it("uses the normal tab gutter while the sidebar covers the traffic lights", () => {
    renderWithProviders(<TabBar />);

    expect(getComputedStyle(screen.getByRole("banner")).paddingLeft).toBe(
      "var(--chakra-spacing-2)",
    );
  });

  it("gives the queue tab no close button", () => {
    renderWithProviders(<TabBar />);

    expect(
      screen.queryByRole("button", { name: "Close Pull Requests" }),
    ).toBeNull();
  });

  it("selects a tab when the user clicks it", async () => {
    useTabs.getState().openPullRequest(pr(1, "Add the tab bar"));
    useTabs.getState().openPullRequest(pr(2, "Fix the diff"));
    renderWithProviders(<TabBar />);
    expect(useTabs.getState().activeId).toBe(second);

    await userEvent.click(screen.getByText("Add the tab bar"));

    expect(useTabs.getState().activeId).toBe(first);
  });

  it("closes a tab when the user clicks its close button", async () => {
    useTabs.getState().openPullRequest(pr(1, "Add the tab bar"));
    renderWithProviders(<TabBar />);

    await userEvent.click(
      screen.getByRole("button", { name: "Close Add the tab bar" }),
    );

    expect(useTabs.getState().tabs.map((tab) => tab.id)).toEqual([
      QUEUE_TAB_ID,
    ]);
  });

  it("closes tabs to the right from the context menu", async () => {
    useTabs.getState().openPullRequest(pr(1, "Add the tab bar"));
    useTabs.getState().openPullRequest(pr(2, "Fix the diff"));
    renderWithProviders(<TabBar />);

    fireEvent.contextMenu(screen.getByText("Add the tab bar"));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Close to the right" }),
    );

    expect(useTabs.getState().tabs.map((tab) => tab.id)).toEqual([
      QUEUE_TAB_ID,
      first,
    ]);
    expect(useTabs.getState().activeId).toBe(first);
  });
});
