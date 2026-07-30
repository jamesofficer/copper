import type {
  AnalysisResult,
  AnalyzedPullRequest,
  ChatMessage,
  DraftReviewComment,
  ExplainRequest,
  Explanation,
  FindingResolution,
  FindingsResult,
  KeyTestResult,
  LlmProviderChoice,
  LlmStatus,
  LlmTask,
  MergeMethod,
  NewPullRequest,
  NewReviewComment,
  PullRequest,
  PullRequestActivity,
  PullRequestComment,
  PullRequestCommit,
  PullRequestDetail,
  PullRequestFile,
  PullRequestReview,
  RepoBranchInfo,
  RepoMergeSettings,
  Repository,
  ReviewComment,
  ReviewDecision,
  ReviewPersonality,
  ReviewVerdict,
  SecretProvider,
  SecretsStatus,
} from "./types";

export interface IpcApi {
  listRepositories(): Promise<Repository[]>;
  addRepository(): Promise<Repository | null>;
  removeRepository(path: string): Promise<Repository[]>;
  // Persists a drag-reordered sidebar list; paths in their new order.
  reorderRepositories(paths: string[]): Promise<Repository[]>;
  listPullRequests(repo: string): Promise<PullRequest[]>;
  // Open PRs across the registered repos where the logged-in user's review is
  // requested.
  listReviewRequestedPullRequests(): Promise<PullRequest[]>;
  // Open PRs across the registered repos authored by the logged-in user.
  listMyPullRequests(): Promise<PullRequest[]>;
  // Open-PR counts per registered repo slug, for the sidebar's repo rows.
  getOpenPullRequestCounts(): Promise<Record<string, number>>;
  // Branches + local checkout defaults for the new-PR dialog.
  getBranchInfo(repo: string): Promise<RepoBranchInfo>;
  createPullRequest(repo: string, pr: NewPullRequest): Promise<PullRequest>;
  getPullRequest(repo: string, prNumber: number): Promise<PullRequestDetail>;
  // GitHub's merge-gating review verdict — REVIEW_REQUIRED while a required
  // approval is missing, null when the base branch doesn't require reviews.
  getReviewDecision(repo: string, prNumber: number): Promise<ReviewDecision>;
  // Close or reopen a pull request.
  setPullRequestState(
    repo: string,
    prNumber: number,
    state: "open" | "closed",
  ): Promise<void>;
  // Take a draft PR out of draft ("Ready for review").
  setPullRequestReady(repo: string, prNumber: number): Promise<void>;
  // Take the signed-in user off a PR's requested reviewers.
  removeReviewRequest(repo: string, prNumber: number): Promise<void>;
  // Rewrite a pull request's description.
  setPullRequestBody(
    repo: string,
    prNumber: number,
    body: string,
  ): Promise<void>;
  // Retarget an open PR onto a different base branch.
  setPullRequestBase(
    repo: string,
    prNumber: number,
    base: string,
  ): Promise<void>;
  // Same data as getPullRequest but without the background repo warm-up —
  // for bulk refreshes (e.g. the recently-viewed panel).
  peekPullRequest(repo: string, prNumber: number): Promise<PullRequestDetail>;
  // Best-effort activity snapshot for the refresh-button highlight — an ETag
  // conditional request (a 304 is free against the rate limit). Null when
  // there's no token or the check fails; polling must never surface errors.
  peekPullRequestActivity(
    repo: string,
    prNumber: number,
  ): Promise<PullRequestActivity | null>;
  listPullRequestFiles(
    repo: string,
    prNumber: number,
  ): Promise<PullRequestFile[]>;
  listPullRequestCommits(
    repo: string,
    prNumber: number,
  ): Promise<PullRequestCommit[]>;
  listCommitFiles(repo: string, commitSha: string): Promise<PullRequestFile[]>;
  // Full file contents at a commit, read from the local workspace clone —
  // null when unavailable. Powers the diff viewer's context expansion,
  // whole-file highlighting, and full-file view.
  getFileAtCommit(
    repo: string,
    sha: string,
    path: string,
  ): Promise<string | null>;
  listPullRequestComments(
    repo: string,
    prNumber: number,
  ): Promise<PullRequestComment[]>;
  listPullRequestReviews(
    repo: string,
    prNumber: number,
  ): Promise<PullRequestReview[]>;
  addPullRequestComment(
    repo: string,
    prNumber: number,
    body: string,
  ): Promise<PullRequestComment>;
  // Inline review comments on diff lines — separate from the conversation
  // comments above.
  listReviewComments(repo: string, prNumber: number): Promise<ReviewComment[]>;
  addReviewComment(
    repo: string,
    prNumber: number,
    comment: NewReviewComment,
  ): Promise<ReviewComment>;
  replyToReviewComment(
    repo: string,
    prNumber: number,
    commentId: number,
    body: string,
  ): Promise<ReviewComment>;
  deleteReviewComment(repo: string, commentId: number): Promise<void>;
  // Root-comment ids of resolved inline threads — resolution only exists in
  // GitHub's GraphQL API, so it's a separate lookup from listReviewComments.
  listResolvedReviewThreads(repo: string, prNumber: number): Promise<number[]>;
  // Resolve/unresolve the inline thread whose first comment is rootCommentId.
  setReviewThreadResolved(
    repo: string,
    prNumber: number,
    rootCommentId: number,
    resolved: boolean,
  ): Promise<void>;
  // Inline comments drafted locally for a batch review. Nothing reaches
  // GitHub until submitReview, which posts them all as one review and then
  // clears them.
  listDraftComments(
    repo: string,
    prNumber: number,
  ): Promise<DraftReviewComment[]>;
  addDraftComment(
    repo: string,
    prNumber: number,
    comment: NewReviewComment,
  ): Promise<DraftReviewComment>;
  updateDraftComment(
    repo: string,
    prNumber: number,
    draftId: string,
    body: string,
  ): Promise<DraftReviewComment>;
  deleteDraftComment(
    repo: string,
    prNumber: number,
    draftId: string,
  ): Promise<void>;
  // Paths the viewer marked as viewed, synced with GitHub's own checkboxes
  // (GraphQL viewerViewedState — a file changed after viewing drops out).
  listViewedFiles(repo: string, prNumber: number): Promise<string[]>;
  setFileViewed(
    repo: string,
    prNumber: number,
    path: string,
    viewed: boolean,
  ): Promise<void>;
  // The GitHub login the stored token belongs to.
  getViewer(): Promise<string>;
  getAnalysis(repo: string, prNumber: number): Promise<AnalysisResult | null>;
  // Pre-review agent pass: candidate issues to verify, anchored to the diff.
  // getFindings is cache-only (null if never run); findIssues runs the model.
  getFindings(repo: string, prNumber: number): Promise<FindingsResult | null>;
  findIssues(
    repo: string,
    prNumber: number,
    force?: boolean,
  ): Promise<FindingsResult>;
  // Record what the user did with a finding — "open" clears it (a restore).
  setFindingResolution(
    repo: string,
    prNumber: number,
    findingId: string,
    resolution: FindingResolution | "open",
  ): Promise<void>;
  // Local-only AI explanations of a selected diff range. explainSelection runs
  // the agent one-shot (not saved to the chat) and persists the result; nothing
  // is ever posted to GitHub.
  listExplanations(repo: string, prNumber: number): Promise<Explanation[]>;
  explainSelection(
    repo: string,
    prNumber: number,
    request: ExplainRequest,
  ): Promise<Explanation>;
  deleteExplanation(
    repo: string,
    prNumber: number,
    explanationId: string,
  ): Promise<void>;
  listAnalyzedPullRequests(): Promise<AnalyzedPullRequest[]>;
  analyzePullRequest(
    repo: string,
    prNumber: number,
    personality: ReviewPersonality,
    force?: boolean,
  ): Promise<AnalysisResult>;
  askQuestion(
    repo: string,
    prNumber: number,
    question: string,
  ): Promise<string>;
  getChatHistory(repo: string, prNumber: number): Promise<ChatMessage[]>;
  clearChat(repo: string, prNumber: number): Promise<void>;
  submitReview(
    repo: string,
    prNumber: number,
    verdict: ReviewVerdict,
    body: string,
  ): Promise<void>;
  // The merge methods the repo's settings allow, so the merge dialog only
  // offers what GitHub would accept.
  getRepoMergeSettings(repo: string): Promise<RepoMergeSettings>;
  mergePullRequest(
    repo: string,
    prNumber: number,
    method: MergeMethod,
  ): Promise<void>;
  getLlmStatus(): Promise<LlmStatus>;
  setLlmProvider(choice: LlmProviderChoice): Promise<LlmStatus>;
  setLlmModel(task: LlmTask, model: string): Promise<LlmStatus>;
  getSecretsStatus(): Promise<SecretsStatus>;
  saveSecret(provider: SecretProvider, value: string): Promise<KeyTestResult>;
  clearSecret(provider: SecretProvider): Promise<SecretsStatus>;
}

// Streaming chat answers are pushed main → renderer as deltas, outside the
// invoke/handle pattern above. askQuestion still resolves with the full text.
export interface ChatChunk {
  repo: string;
  prNumber: number;
  text: string;
}

export const chatChunkChannel = "chatChunk";

export interface RendererEvents {
  onChatChunk(listener: (chunk: ChatChunk) => void): () => void;
}

export type WindowApi = IpcApi & RendererEvents;

export const ipcChannels = [
  "listRepositories",
  "addRepository",
  "removeRepository",
  "reorderRepositories",
  "listPullRequests",
  "listReviewRequestedPullRequests",
  "listMyPullRequests",
  "getOpenPullRequestCounts",
  "getBranchInfo",
  "createPullRequest",
  "getPullRequest",
  "getReviewDecision",
  "setPullRequestState",
  "setPullRequestReady",
  "setPullRequestBase",
  "setPullRequestBody",
  "removeReviewRequest",
  "peekPullRequest",
  "peekPullRequestActivity",
  "listPullRequestFiles",
  "listPullRequestCommits",
  "listCommitFiles",
  "getFileAtCommit",
  "listPullRequestComments",
  "listPullRequestReviews",
  "addPullRequestComment",
  "listReviewComments",
  "addReviewComment",
  "replyToReviewComment",
  "deleteReviewComment",
  "listResolvedReviewThreads",
  "setReviewThreadResolved",
  "listDraftComments",
  "addDraftComment",
  "updateDraftComment",
  "deleteDraftComment",
  "listViewedFiles",
  "setFileViewed",
  "getViewer",
  "getAnalysis",
  "getFindings",
  "findIssues",
  "setFindingResolution",
  "listExplanations",
  "explainSelection",
  "deleteExplanation",
  "listAnalyzedPullRequests",
  "analyzePullRequest",
  "askQuestion",
  "getChatHistory",
  "clearChat",
  "submitReview",
  "getRepoMergeSettings",
  "mergePullRequest",
  "getLlmStatus",
  "setLlmProvider",
  "setLlmModel",
  "getSecretsStatus",
  "saveSecret",
  "clearSecret",
] as const satisfies readonly (keyof IpcApi)[];
