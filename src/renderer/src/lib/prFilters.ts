import type { PullRequest } from "../../../shared/types";

// GitHub's list-sort options, minus "Best match" (that needs a search query).
export type PullRequestSort =
  | "newest"
  | "oldest"
  | "most_commented"
  | "least_commented"
  | "recently_updated"
  | "least_recently_updated";

export const sortOptions: Array<{ value: PullRequestSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "most_commented", label: "Most commented" },
  { value: "least_commented", label: "Least commented" },
  { value: "recently_updated", label: "Recently updated" },
  { value: "least_recently_updated", label: "Least recently updated" },
];

// "all" means no filter; assignee also accepts "none" for unassigned PRs.
export function filterPullRequests(
  prs: PullRequest[],
  author: string,
  assignee: string,
): PullRequest[] {
  return prs.filter((pr) => {
    if (author !== "all" && pr.author !== author) return false;
    if (assignee === "all") return true;
    const assignees = pr.assignees ?? [];
    return assignee === "none"
      ? assignees.length === 0
      : assignees.includes(assignee);
  });
}

// PR numbers break ties: they follow creation order, which keeps the sorts
// meaningful even for entries revived from an older persisted cache whose
// dates are missing (they parse to 0, so every pair would otherwise tie).
const comparators: Record<
  PullRequestSort,
  (a: PullRequest, b: PullRequest) => number
> = {
  newest: (a, b) =>
    time(b.createdAt) - time(a.createdAt) || b.number - a.number,
  oldest: (a, b) =>
    time(a.createdAt) - time(b.createdAt) || a.number - b.number,
  most_commented: (a, b) => b.comments - a.comments,
  least_commented: (a, b) => a.comments - b.comments,
  recently_updated: (a, b) =>
    time(b.updatedAt) - time(a.updatedAt) || b.number - a.number,
  least_recently_updated: (a, b) =>
    time(a.updatedAt) - time(b.updatedAt) || a.number - b.number,
};

function time(value: string | undefined): number {
  return value ? Date.parse(value) : 0;
}

export function sortPullRequests(
  prs: PullRequest[],
  sort: PullRequestSort,
): PullRequest[] {
  return [...prs].sort(comparators[sort]);
}
