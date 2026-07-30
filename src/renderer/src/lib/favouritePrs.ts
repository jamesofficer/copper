import { useSyncExternalStore } from "react";
import type { PullRequest } from "../../../shared/types";

// Pull requests the user starred, kept locally — a personal shortlist, not a
// GitHub concept. The whole PR is stored (not just repo + number) so the
// sidebar can list favourites without a query per row; newest star first.
const STORAGE_KEY = "favouritePullRequests";

export type FavouritePullRequest = PullRequest & { favouritedAt: string };

export function favouriteKey(pr: { repo: string; number: number }): string {
  return `${pr.repo}#${pr.number}`;
}

function load(): FavouritePullRequest[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? (parsed as FavouritePullRequest[]) : [];
  } catch {
    return [];
  }
}

let current = load();
const listeners = new Set<() => void>();

function save(favourites: FavouritePullRequest[]): void {
  current = favourites;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favourites));
  for (const listener of listeners) listener();
}

function getSnapshot(): FavouritePullRequest[] {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isFavourite(pr: { repo: string; number: number }): boolean {
  const key = favouriteKey(pr);
  return current.some((item) => favouriteKey(item) === key);
}

export function addFavourite(pr: PullRequest): void {
  if (isFavourite(pr)) return;
  save([{ ...pr, favouritedAt: new Date().toISOString() }, ...current]);
}

export function removeFavourite(pr: { repo: string; number: number }): void {
  const key = favouriteKey(pr);
  save(current.filter((item) => favouriteKey(item) !== key));
}

// Re-stores the PR each time it's starred, so a stale title from an older
// session is refreshed rather than kept.
export function toggleFavourite(pr: PullRequest): void {
  if (isFavourite(pr)) removeFavourite(pr);
  else addFavourite(pr);
}

export function useFavouritePullRequests(): FavouritePullRequest[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useIsFavourite(pr: { repo: string; number: number }): boolean {
  const favourites = useFavouritePullRequests();
  const key = favouriteKey(pr);
  return favourites.some((item) => favouriteKey(item) === key);
}
