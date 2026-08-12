import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getLocalCommitFiles, listLocalCommits } from "./commits";

const run = promisify(execFile);

// Against a real repo, like changes.test.ts: what is in doubt is whether git
// answers the way this module assumes — branch ranges, merge diffs, and the
// log format a mock could only ever confirm back at me.
let repo: string;

async function git(...args: string[]): Promise<string> {
  const { stdout } = await run("git", ["-C", repo, ...args]);
  return stdout;
}

async function commit(path: string, contents: string, message: string) {
  await writeFile(join(repo, path), contents);
  await git("add", ".");
  await git("commit", "-qm", message);
}

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "reviewr-commits-"));
  await git("init", "-q", "-b", "main");
  await git("config", "user.email", "test@example.com");
  await git("config", "user.name", "Test");
  await git("config", "commit.gpgsign", "false");
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe("listLocalCommits", () => {
  it("lists the branch's own commits, newest first", async () => {
    await commit("a.txt", "a\n", "first");
    await git("checkout", "-q", "-b", "feature");
    await commit("b.txt", "b\n", "second");
    await commit("c.txt", "c\n", "third");

    const list = await listLocalCommits(repo);

    expect(list.branch).toBe("feature");
    expect(list.base).toBe("main");
    expect(list.commits.map((entry) => entry.subject)).toEqual([
      "third",
      "second",
    ]);
    expect(list.commits[0].author).toBe("Test");
  });

  it("keeps a multi-line message's body apart from its subject", async () => {
    await commit("a.txt", "a\n", "first");
    await git("checkout", "-q", "-b", "feature");
    await writeFile(join(repo, "b.txt"), "b\n");
    await git("add", ".");
    await git("commit", "-qm", "subject line\n\nwhy it was done\nand how");

    const [entry] = (await listLocalCommits(repo)).commits;

    expect(entry.subject).toBe("subject line");
    expect(entry.body).toBe("why it was done\nand how");
  });

  it("falls back to recent history when the branch is level with its trunk", async () => {
    await commit("a.txt", "a\n", "first");

    const list = await listLocalCommits(repo);

    expect(list.base).toBeNull();
    expect(list.commits.map((entry) => entry.subject)).toEqual(["first"]);
  });

  it("reports an empty branch rather than failing on a repo with no commits", async () => {
    const list = await listLocalCommits(repo);

    expect(list.commits).toEqual([]);
    expect(list.branch).toBe("main");
  });
});

describe("getLocalCommitFiles", () => {
  it("returns one commit's changes as diff files", async () => {
    await commit("a.txt", "one\n", "first");
    await commit("a.txt", "two\n", "second");
    const sha = (await git("rev-parse", "HEAD")).trim();

    const files = await getLocalCommitFiles(repo, sha);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("a.txt");
    expect(files[0].status).toBe("modified");
    expect(files[0].additions).toBe(1);
    expect(files[0].deletions).toBe(1);
    expect(files[0].patch).toContain("+two");
  });

  it("diffs a merge against its first parent, not as a combined diff", async () => {
    await commit("a.txt", "a\n", "first");
    await git("checkout", "-q", "-b", "feature");
    await commit("b.txt", "b\n", "on the branch");
    await git("checkout", "-q", "main");
    await commit("c.txt", "c\n", "on main");
    await git("merge", "-q", "--no-ff", "-m", "merge feature", "feature");
    const sha = (await git("rev-parse", "HEAD")).trim();

    const files = await getLocalCommitFiles(repo, sha);

    expect(files.map((file) => file.path)).toEqual(["b.txt"]);
    expect(files[0].status).toBe("added");
  });

  it("refuses anything that isn't a commit id", async () => {
    await expect(getLocalCommitFiles(repo, "--output=/tmp/x")).rejects.toThrow(
      /not a commit id/i,
    );
  });
});
