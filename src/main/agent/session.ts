// TODO: Claude Agent SDK session per open PR, with repo-context tools
// (read_file, grep_repo, git_log, get_diff) and persisted chat history
export async function askQuestion(
	repo: string,
	prNumber: number,
	question: string,
): Promise<string> {
	return `(agent not wired up yet) You asked about ${repo}#${prNumber}: "${question}"`;
}
