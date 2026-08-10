import { describe, expect, it } from "vitest";
import type { PullRequest, RepoIssue } from "../../../shared/types";
import {
  assigneeOptions,
  authorOptions,
  filterByPeople,
  sortListItems,
} from "./listFilters";

function pr(overrides: Partial<PullRequest>): PullRequest {
  return {
    repo: "acme/app",
    number: 1,
    title: "A change",
    author: "ada",
    draft: false,
    reviewStatus: "awaiting_review",
    headSha: "abc1234",
    url: "https://github.com/acme/app/pull/1",
    additions: 0,
    deletions: 0,
    changedFiles: 0,
    comments: 0,
    assignees: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function issue(overrides: Partial<RepoIssue>): RepoIssue {
  return {
    repo: "acme/app",
    number: 1,
    title: "Something is broken",
    author: "ada",
    url: "https://github.com/acme/app/issues/1",
    labels: [],
    assignees: [],
    comments: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("filterByPeople", () => {
  it("keeps everything when both filters are 'all'", () => {
    const items = [pr({ number: 1 }), pr({ number: 2, author: "grace" })];
    expect(filterByPeople(items, "all", "all")).toHaveLength(2);
  });

  it("filters by author", () => {
    const items = [pr({ number: 1 }), pr({ number: 2, author: "grace" })];
    expect(filterByPeople(items, "grace", "all").map((i) => i.number)).toEqual([
      2,
    ]);
  });

  it("treats 'none' as unassigned", () => {
    const items = [
      issue({ number: 1, assignees: ["ada"] }),
      issue({ number: 2, assignees: [] }),
    ];
    expect(filterByPeople(items, "all", "none").map((i) => i.number)).toEqual([
      2,
    ]);
  });

  it("filters issues by assignee", () => {
    const items = [
      issue({ number: 1, assignees: ["ada", "grace"] }),
      issue({ number: 2, assignees: ["grace"] }),
      issue({ number: 3 }),
    ];
    expect(filterByPeople(items, "all", "ada").map((i) => i.number)).toEqual([
      1,
    ]);
  });
});

describe("sortListItems", () => {
  const items = [
    issue({
      number: 1,
      comments: 5,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-03-01T00:00:00Z",
    }),
    issue({
      number: 2,
      comments: 1,
      createdAt: "2026-02-01T00:00:00Z",
      updatedAt: "2026-01-15T00:00:00Z",
    }),
  ];

  it("sorts newest and oldest by creation date", () => {
    expect(sortListItems(items, "newest").map((i) => i.number)).toEqual([2, 1]);
    expect(sortListItems(items, "oldest").map((i) => i.number)).toEqual([1, 2]);
  });

  it("sorts by comment count", () => {
    expect(sortListItems(items, "most_commented").map((i) => i.number)).toEqual(
      [1, 2],
    );
    expect(
      sortListItems(items, "least_commented").map((i) => i.number),
    ).toEqual([2, 1]);
  });

  it("sorts by update date, which is not creation order", () => {
    expect(
      sortListItems(items, "recently_updated").map((i) => i.number),
    ).toEqual([1, 2]);
  });

  it("does not mutate the input", () => {
    const original = [...items];
    sortListItems(items, "oldest");
    expect(items).toEqual(original);
  });

  it("breaks ties on number when dates are missing", () => {
    const undated = [
      pr({ number: 1, createdAt: "", updatedAt: "" }),
      pr({ number: 7, createdAt: "", updatedAt: "" }),
    ];
    expect(sortListItems(undated, "newest").map((i) => i.number)).toEqual([
      7, 1,
    ]);
  });
});

describe("filter options", () => {
  it("lists each author once, sorted, behind an 'All' entry", () => {
    const items = [
      issue({ number: 1, author: "grace" }),
      issue({ number: 2, author: "ada" }),
      issue({ number: 3, author: "grace" }),
    ];
    expect(authorOptions(items)).toEqual([
      { value: "all", label: "All authors" },
      { value: "ada", label: "ada", avatar: "ada" },
      { value: "grace", label: "grace", avatar: "grace" },
    ]);
  });

  it("offers 'Assigned to nobody' before the assignees", () => {
    const items = [issue({ number: 1, assignees: ["ada"] })];
    expect(assigneeOptions(items).map((option) => option.value)).toEqual([
      "all",
      "none",
      "ada",
    ]);
  });
});
