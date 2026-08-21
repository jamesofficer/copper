export type PullRequestPeopleKind = "reviewers" | "assignees";

export function setPersonSelected(
  selected: string[],
  login: string,
  nextSelected: boolean,
): string[] {
  if (nextSelected) {
    return selected.includes(login) ? selected : [...selected, login];
  }
  return selected.filter((entry) => entry !== login);
}

export function peopleOptions(
  candidates: string[],
  selected: string[],
  excluded: string[] = [],
): string[] {
  const blocked = new Set(excluded);
  return [...new Set([...selected, ...candidates])]
    .filter((login) => !blocked.has(login))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
