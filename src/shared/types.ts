export interface Repository {
	path: string;
	name: string;
	slug: string | null;
}

export interface PullRequest {
	repo: string;
	number: number;
	title: string;
	author: string;
	headSha: string;
	url: string;
	additions: number;
	deletions: number;
	changedFiles: number;
}

export type FileStatus = "added" | "modified" | "deleted" | "renamed";

export interface ChangedFile {
	path: string;
	status: FileStatus;
	additions: number;
	deletions: number;
	mechanical: boolean;
}

export type Risk = "low" | "medium" | "high";

export interface ChangeGroup {
	id: string;
	title: string;
	why: string;
	files: string[];
	risk: Risk;
	mechanical: boolean;
}

export interface SummaryLenses {
	overview: string;
	risks: string;
	behavior: string;
	scope: string;
}

export interface AnalysisResult {
	repo: string;
	prNumber: number;
	headSha: string;
	files: ChangedFile[];
	groups: ChangeGroup[];
	readingOrder: string[];
	summaries: SummaryLenses | null;
}

export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
}
