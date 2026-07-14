import type { AnalysisResult } from "../../shared/types";

// TODO: move to SQLite so analysis survives restarts; keyed by repo + PR + head SHA
const memoryCache = new Map<string, AnalysisResult>();

function cacheKey(repo: string, prNumber: number, headSha: string): string {
	return `${repo}#${prNumber}@${headSha}`;
}

export function getCachedAnalysis(
	repo: string,
	prNumber: number,
	headSha: string,
): AnalysisResult | undefined {
	return memoryCache.get(cacheKey(repo, prNumber, headSha));
}

export function setCachedAnalysis(result: AnalysisResult): void {
	memoryCache.set(
		cacheKey(result.repo, result.prNumber, result.headSha),
		result,
	);
}
