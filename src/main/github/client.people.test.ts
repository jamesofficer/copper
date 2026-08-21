import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getGitHubToken: vi.fn(),
  githubRequest: vi.fn(),
}));

vi.mock("./auth", () => ({ getGitHubToken: mocks.getGitHubToken }));
vi.mock("./rateLimit", () => ({
  githubRequest: mocks.githubRequest,
  hasGraphQlRateLimitError: () => false,
}));

import {
  listRepositoryPeople,
  setPullRequestAssignee,
  setPullRequestReviewer,
} from "./client";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  mocks.getGitHubToken.mockReset();
  mocks.getGitHubToken.mockResolvedValue("token");
  mocks.githubRequest.mockReset();
});

describe("pull request people", () => {
  it("loads assignable users and repository collaborators", async () => {
    mocks.githubRequest.mockImplementation(
      async (_token: string, path: string) =>
        path.includes("/assignees")
          ? jsonResponse([{ login: "grace" }])
          : jsonResponse([{ login: "ada" }, { login: "grace" }]),
    );

    await expect(listRepositoryPeople("acme/app")).resolves.toEqual({
      reviewers: ["ada", "grace"],
      assignees: ["grace"],
    });
    expect(mocks.githubRequest).toHaveBeenCalledWith(
      "token",
      "/repos/acme/app/assignees?per_page=100&page=1",
      undefined,
    );
    expect(mocks.githubRequest).toHaveBeenCalledWith(
      "token",
      "/repos/acme/app/collaborators?per_page=100&page=1",
      undefined,
    );
  });

  it("uses GitHub's review-request and issue-assignee endpoints", async () => {
    mocks.githubRequest.mockImplementation(async () => jsonResponse({}));

    await setPullRequestReviewer("acme/app", 7, "grace", true);
    await setPullRequestAssignee("acme/app", 7, "ada", false);

    expect(mocks.githubRequest).toHaveBeenNthCalledWith(
      1,
      "token",
      "/repos/acme/app/pulls/7/requested_reviewers",
      { method: "POST", body: { reviewers: ["grace"] } },
    );
    expect(mocks.githubRequest).toHaveBeenNthCalledWith(
      2,
      "token",
      "/repos/acme/app/issues/7/assignees",
      { method: "DELETE", body: { assignees: ["ada"] } },
    );
  });
});
