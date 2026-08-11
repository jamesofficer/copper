// The people filters and sorts shared by the home screen's pull-request and
// issue lists. Both GitHub types carry these fields, so one implementation
// serves both — a second copy would only drift.
export interface Listable {
  number: number;
  title: string;
  author: string;
  assignees?: string[];
  comments: number;
  createdAt: string;
  updatedAt: string;
}

// GitHub's list-sort options, minus "Best match" (that needs a search query).
export type ListSort =
  | "newest"
  | "oldest"
  | "most_commented"
  | "least_commented"
  | "recently_updated"
  | "least_recently_updated";

export const sortOptions: Array<{ value: ListSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "most_commented", label: "Most commented" },
  { value: "least_commented", label: "Least commented" },
  { value: "recently_updated", label: "Recently updated" },
  { value: "least_recently_updated", label: "Least recently updated" },
];

// "all" means no filter; assignee also accepts "none" for unassigned items.
export function filterByPeople<T extends Listable>(
  items: T[],
  author: string,
  assignee: string,
): T[] {
  return items.filter((item) => {
    if (author !== "all" && item.author !== author) return false;
    if (assignee === "all") return true;
    const assignees = item.assignees ?? [];
    return assignee === "none"
      ? assignees.length === 0
      : assignees.includes(assignee);
  });
}

// Which timestamp a row should show. A row carrying "updated 5m ago" in a list
// ordered by when things were opened reads as a broken sort, so the time
// follows the sort rather than always being one or the other.
export function sortTimeField(sort: ListSort): "createdAt" | "updatedAt" {
  return sort === "recently_updated" || sort === "least_recently_updated"
    ? "updatedAt"
    : "createdAt";
}

// The queue's filter box. Matches the three things a reviewer types when
// looking for a known item: words from its title, its author, or its number
// (with or without the "#" GitHub prints in front of it).
export function filterByText<T extends Listable>(
  items: T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  const digits = needle.startsWith("#") ? needle.slice(1) : needle;
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(needle) ||
      item.author.toLowerCase().includes(needle) ||
      (digits.length > 0 && String(item.number).includes(digits)),
  );
}

// Numbers break ties: they follow creation order, which keeps the sorts
// meaningful even for entries revived from an older persisted cache whose
// dates are missing (they parse to 0, so every pair would otherwise tie).
const comparators: Record<ListSort, (a: Listable, b: Listable) => number> = {
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

export function sortListItems<T extends Listable>(
  items: T[],
  sort: ListSort,
): T[] {
  return [...items].sort(comparators[sort]);
}

// The Author and Assignee dropdown options for a loaded list. Both lists build
// them the same way: every login that actually appears, sorted, behind an
// "All …" entry.
export interface PeopleFilterItem {
  value: string;
  label: string;
  // GitHub login to show an avatar for — absent on the "All …" entries.
  avatar?: string;
}

export function authorOptions(items: Listable[]): PeopleFilterItem[] {
  const logins = [...new Set(items.map((item) => item.author))].sort();
  return [
    { value: "all", label: "All authors" },
    ...logins.map((login) => ({ value: login, label: login, avatar: login })),
  ];
}

export function assigneeOptions(items: Listable[]): PeopleFilterItem[] {
  const logins = [
    ...new Set(items.flatMap((item) => item.assignees ?? [])),
  ].sort();
  return [
    { value: "all", label: "All assignees" },
    { value: "none", label: "Assigned to nobody" },
    ...logins.map((login) => ({ value: login, label: login, avatar: login })),
  ];
}
