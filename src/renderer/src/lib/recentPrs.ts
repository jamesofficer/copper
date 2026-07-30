import type { PullRequest } from "../../../shared/types";

const STORAGE_KEY = "recentPullRequests";
const MAX_RECENT = 7;

export type RecentPullRequest = PullRequest & { viewedAt: string };

export function listRecentPullRequests(): RecentPullRequest[] {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as RecentPullRequest[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function recordRecentPullRequest(pr: PullRequest): void {
  const entry: RecentPullRequest = {
    ...pr,
    viewedAt: new Date().toISOString(),
  };
  const rest = listRecentPullRequests().filter(
    (item) => !(item.repo === pr.repo && item.number === pr.number),
  );
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([entry, ...rest].slice(0, MAX_RECENT)),
  );
}

export function clearRecentPullRequests(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
