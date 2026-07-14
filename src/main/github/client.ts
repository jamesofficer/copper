import type { PullRequest } from "../../shared/types";

// TODO: replace mock data with Octokit (open PRs for the given repo)
export async function listReviewRequests(repo: string): Promise<PullRequest[]> {
	return [
		{
			repo,
			number: 1421,
			title: "feat: add campaign scheduling",
			author: "sam",
			headSha: "a1b2c3d",
			url: `https://github.com/${repo}/pull/1421`,
			additions: 512,
			deletions: 88,
			changedFiles: 14,
		},
		{
			repo,
			number: 1425,
			title: "fix: dedupe contacts on import",
			author: "alex",
			headSha: "e4f5a6b",
			url: `https://github.com/${repo}/pull/1425`,
			additions: 63,
			deletions: 12,
			changedFiles: 3,
		},
	];
}
