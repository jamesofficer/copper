import type { PullRequest } from "../../shared/types";
import { getGitHubToken } from "./auth";

const API = "https://api.github.com";

interface GitHubPullSummary {
  number: number;
  title: string;
  user: { login: string } | null;
  head: { sha: string };
  html_url: string;
}

interface GitHubPullDetail extends GitHubPullSummary {
  additions: number;
  deletions: number;
  changed_files: number;
}

async function githubFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "pr-reviewer",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (res.status === 401) {
    throw new Error("GitHub rejected your token. Re-check it in settings.");
  }
  if (res.status === 404) {
    throw new Error(
      "Couldn't find this repository on GitHub. Check its origin remote.",
    );
  }
  if (!res.ok) {
    throw new Error(`GitHub returned status ${res.status}.`);
  }

  return res.json() as Promise<T>;
}

export async function listReviewRequests(repo: string): Promise<PullRequest[]> {
  if (!repo.includes("/")) {
    throw new Error(
      "This repository has no GitHub remote, so pull requests can't be loaded.",
    );
  }

  const token = await getGitHubToken();
  if (!token) {
    throw new Error(
      "Connect a GitHub token in settings to load pull requests.",
    );
  }

  const summaries = await githubFetch<GitHubPullSummary[]>(
    token,
    `/repos/${repo}/pulls?state=open&sort=updated&direction=desc&per_page=50`,
  );

  const details = await Promise.all(
    summaries.map((summary) =>
      githubFetch<GitHubPullDetail>(
        token,
        `/repos/${repo}/pulls/${summary.number}`,
      ),
    ),
  );

  return details.map((pull) => ({
    repo,
    number: pull.number,
    title: pull.title,
    author: pull.user?.login ?? "unknown",
    headSha: pull.head.sha.slice(0, 7),
    url: pull.html_url,
    additions: pull.additions,
    deletions: pull.deletions,
    changedFiles: pull.changed_files,
  }));
}
