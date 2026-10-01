import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  commitChanges,
  discardChanges,
  getLocalChangeCount,
  getLocalChanges,
  getLocalFile,
  stageFiles,
  unstageFiles,
} from "./changes";

const run = promisify(execFile);

// Against a real repo, not a mocked execFile. What is being defended here is
// "does git behave the way this module assumes" — a mock would only ever
// confirm my own assumptions, which is the thing in doubt. These commands
// destroy work when they are wrong, so the test pays the cost of real I/O.
let repo: string;

async function git(...args: string[]): Promise<string> {
  const { stdout } = await run("git", ["-C", repo, ...args]);
  return stdout;
}

async function write(path: string, contents: string): Promise<void> {
  await writeFile(join(repo, path), contents);
}

function exists(path: string): boolean {
  return existsSync(join(repo, path));
}

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "copper-changes-"));
  await git("init", "-q", "-b", "main");
  await git("config", "user.email", "test@example.com");
  await git("config", "user.name", "Test");
  await git("config", "commit.gpgsign", "false");
});

afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

async function commitInitial(): Promise<void> {
  await write("tracked.txt", "v1\n");
  await git("add", ".");
  await git("commit", "-qm", "init");
}

describe("getLocalChangeCount", () => {
  it("counts a partially staged path once", async () => {
    await commitInitial();
    await write("tracked.txt", "staged\n");
    await git("add", "tracked.txt");
    await write("tracked.txt", "staged then edited again\n");
    await write("new.txt", "untracked\n");

    expect(await getLocalChangeCount(repo)).toBe(2);
  });

  it("counts a rename as one changed path", async () => {
    await commitInitial();
    // The detailed diff always enables rename detection with -M, so the cheap
    // count must agree even when this repository disables it for status.
    await git("config", "status.renames", "false");
    await git("mv", "tracked.txt", "renamed.txt");

    expect(await getLocalChangeCount(repo)).toBe(1);
  });
});

describe("getLocalFile", () => {
  it("reads the new side from a commit, the index, and the working tree", async () => {
    await commitInitial();
    const sha = (await git("rev-parse", "HEAD")).trim();
    await write("tracked.txt", "staged\n");
    await git("add", "tracked.txt");
    await write("tracked.txt", "working\n");

    await expect(
      getLocalFile(repo, { kind: "commit", sha }, "tracked.txt"),
    ).resolves.toBe("v1\n");
    await expect(
      getLocalFile(repo, { kind: "index" }, "tracked.txt"),
    ).resolves.toBe("staged\n");
    await expect(
      getLocalFile(repo, { kind: "working" }, "tracked.txt"),
    ).resolves.toBe("working\n");
  });

  it("rejects paths outside the checkout and binary contents", async () => {
    await write("binary.dat", "before\u0000after");

    await expect(
      getLocalFile(repo, { kind: "working" }, "../outside.txt"),
    ).resolves.toBeNull();
    await expect(
      getLocalFile(repo, { kind: "working" }, "binary.dat"),
    ).resolves.toBeNull();
  });
});

describe("getLocalChanges", () => {
  it("splits the index from the working tree", async () => {
    await commitInitial();
    await write("other.txt", "v1\n");
    await git("add", "other.txt");
    await git("commit", "-qm", "second");
    await write("tracked.txt", "staged\n");
    await git("add", "tracked.txt");
    await write("other.txt", "edited\n");

    const changes = await getLocalChanges(repo);

    expect(changes.staged.map((f) => f.path)).toEqual(["tracked.txt"]);
    expect(changes.unstaged.map((f) => f.path)).toEqual(["other.txt"]);
  });

  it("reports a partially staged path in both lists", async () => {
    await commitInitial();
    await write("tracked.txt", "staged\n");
    await git("add", "tracked.txt");
    await write("tracked.txt", "staged then edited again\n");

    const changes = await getLocalChanges(repo);

    // Not a duplicate: the index and the working tree genuinely differ from
    // their respective bases, and each row shows a different diff. Collapsing
    // them would hide half the change from the person about to commit.
    expect(changes.staged.map((f) => f.path)).toEqual(["tracked.txt"]);
    expect(changes.unstaged.map((f) => f.path)).toEqual(["tracked.txt"]);
  });

  it("names the untracked paths rather than leaving them to be guessed", async () => {
    await commitInitial();
    await write("new.txt", "brand new\n");
    await write("tracked.txt", "edited\n");

    const changes = await getLocalChanges(repo);

    // The discard confirmation words itself off this: an untracked file is
    // deleted, a tracked one is reverted.
    expect(changes.untracked).toEqual(["new.txt"]);
    expect(changes.unstaged.map((f) => f.path).sort()).toEqual([
      "new.txt",
      "tracked.txt",
    ]);
  });

  it("surfaces a staged diff failure when HEAD exists", async () => {
    await commitInitial();
    await write("tracked.txt", "staged\n");
    await git("add", "tracked.txt");

    const bin = await mkdtemp(join(tmpdir(), "copper-fake-git-"));
    const shim = join(bin, "git");
    const { stdout: realGit } = await run("which", ["git"]);
    await writeFile(
      shim,
      `#!/bin/sh\nif [ "$5" = "diff" ] && [ "$6" = "--cached" ] && [ "$7" = "HEAD" ]; then\n  echo "simulated staged diff failure" >&2\n  exit 1\nfi\nexec "${realGit.trim()}" "$@"\n`,
    );
    await chmod(shim, 0o755);
    const previousPath = process.env.PATH;
    process.env.PATH = `${bin}:${previousPath ?? ""}`;
    try {
      await expect(getLocalChanges(repo)).rejects.toThrow(
        /simulated staged diff failure/i,
      );
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      await rm(bin, { recursive: true, force: true });
    }
  });

  it("shows staged files in a repo with no commits, where there is no HEAD", async () => {
    await write("first.txt", "hello\n");
    await git("add", "first.txt");

    const changes = await getLocalChanges(repo);

    expect(changes.staged.map((f) => f.path)).toEqual(["first.txt"]);
  });
});

describe("discardChanges", () => {
  it("reverts a tracked file to its staged state, keeping the staged work", async () => {
    await commitInitial();
    await write("tracked.txt", "deliberately staged\n");
    await git("add", "tracked.txt");
    await write("tracked.txt", "scratch edit to throw away\n");

    await discardChanges(repo, ["tracked.txt"]);

    // The staged half was an explicit act of keeping; only the later edit goes.
    expect(await readFile(join(repo, "tracked.txt"), "utf8")).toBe(
      "deliberately staged\n",
    );
    expect(await git("diff", "--cached", "--name-only")).toContain(
      "tracked.txt",
    );
  });

  it("deletes an untracked file, which git cannot restore", async () => {
    await commitInitial();
    await write("new.txt", "never committed\n");

    await discardChanges(repo, ["new.txt"]);

    expect(exists("new.txt")).toBe(false);
  });

  it("handles a mixed batch, since restore alone errors on untracked paths", async () => {
    await commitInitial();
    await write("tracked.txt", "edited\n");
    await write("new.txt", "brand new\n");

    await discardChanges(repo, ["tracked.txt", "new.txt"]);

    expect(await readFile(join(repo, "tracked.txt"), "utf8")).toBe("v1\n");
    expect(exists("new.txt")).toBe(false);
  });

  it("treats glob characters in a filename literally", async () => {
    await write("[id].tsx", "selected v1\n");
    await write("i.tsx", "other v1\n");
    await git("add", ".");
    await git("commit", "-qm", "special names");
    await write("[id].tsx", "selected edited\n");
    await write("i.tsx", "other edited\n");

    await discardChanges(repo, ["[id].tsx"]);

    // Git pathspecs treat [id] as a character class unless literal mode is
    // forced. Discard must never revert a similarly named file the user did
    // not confirm while leaving the selected file untouched.
    expect(await readFile(join(repo, "[id].tsx"), "utf8")).toBe(
      "selected v1\n",
    );
    expect(await readFile(join(repo, "i.tsx"), "utf8")).toBe("other edited\n");
  });

  it("leaves ignored files alone", async () => {
    await commitInitial();
    await write(".gitignore", "*.log\n");
    await git("add", ".gitignore");
    await git("commit", "-qm", "ignore logs");
    await write("debug.log", "secrets\n");
    await write("tracked.txt", "edited\n");

    await discardChanges(repo, ["tracked.txt", "debug.log"]);

    // "clean -f" without -x. An ignored path is typically a .env or a build
    // artefact: expensive or impossible to recreate, and never what the user
    // meant to discard.
    expect(exists("debug.log")).toBe(true);
    // And the rest of the batch still went through. Classifying the ignored
    // path as tracked sent it to restore, which rejected the unknown pathspec
    // and abandoned the whole call — leaving the user's click doing nothing.
    expect(await readFile(join(repo, "tracked.txt"), "utf8")).toBe("v1\n");
  });

  it("does nothing when given no paths", async () => {
    await commitInitial();
    await write("tracked.txt", "edited\n");

    await discardChanges(repo, []);

    expect(await readFile(join(repo, "tracked.txt"), "utf8")).toBe("edited\n");
  });
});

describe("stageFiles and unstageFiles", () => {
  it("stages a deletion, not just an edit", async () => {
    await commitInitial();
    await rm(join(repo, "tracked.txt"));

    await stageFiles(repo, ["tracked.txt"]);

    expect(await git("diff", "--cached", "--name-status")).toContain(
      "D\ttracked.txt",
    );
  });

  it("treats glob characters literally when staging and unstaging", async () => {
    await write("[id].tsx", "selected v1\n");
    await write("i.tsx", "other v1\n");
    await git("add", ".");
    await git("commit", "-qm", "special names");
    await write("[id].tsx", "selected edited\n");
    await write("i.tsx", "other edited\n");

    await stageFiles(repo, ["[id].tsx"]);

    expect((await git("diff", "--cached", "--name-only")).trim()).toBe(
      "[id].tsx",
    );

    await git("add", "i.tsx");
    await unstageFiles(repo, ["[id].tsx"]);

    expect((await git("diff", "--cached", "--name-only")).trim()).toBe("i.tsx");
  });

  it("surfaces a restore failure instead of treating it as an unborn HEAD", async () => {
    await commitInitial();
    await write("tracked.txt", "staged\n");
    await git("add", "tracked.txt");

    // Put a deterministic failing restore in front of real git. The old
    // fallback swallowed every restore failure and ran `rm --cached`, even in
    // a repository with a valid HEAD.
    const bin = await mkdtemp(join(tmpdir(), "copper-fake-git-"));
    const shim = join(bin, "git");
    const { stdout: realGit } = await run("which", ["git"]);
    await writeFile(
      shim,
      `#!/bin/sh\nif [ "$5" = "restore" ] && [ "$6" = "--staged" ]; then\n  echo "simulated restore failure" >&2\n  exit 1\nfi\nexec "${realGit.trim()}" "$@"\n`,
    );
    await chmod(shim, 0o755);
    const previousPath = process.env.PATH;
    process.env.PATH = `${bin}:${previousPath ?? ""}`;
    try {
      await expect(unstageFiles(repo, ["tracked.txt"])).rejects.toThrow(
        /simulated restore failure/i,
      );
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      await rm(bin, { recursive: true, force: true });
    }

    expect(await git("diff", "--cached", "--name-only")).toContain(
      "tracked.txt",
    );
  });

  it("unstages in a repo with no commits, where restore has no HEAD to use", async () => {
    await write("first.txt", "hello\n");
    await stageFiles(repo, ["first.txt"]);

    await unstageFiles(repo, ["first.txt"]);

    // The file survives as untracked; only the index entry goes.
    const changes = await getLocalChanges(repo);
    expect(changes.staged).toEqual([]);
    expect(changes.untracked).toEqual(["first.txt"]);
    expect(exists("first.txt")).toBe(true);
  });

  it("unstages in a repo with no commits even after the file was edited", async () => {
    await write("first.txt", "staged\n");
    await stageFiles(repo, ["first.txt"]);
    await write("first.txt", "edited after staging\n");

    await unstageFiles(repo, ["first.txt"]);

    const changes = await getLocalChanges(repo);
    expect(changes.staged).toEqual([]);
    expect(changes.untracked).toEqual(["first.txt"]);
    expect(await readFile(join(repo, "first.txt"), "utf8")).toBe(
      "edited after staging\n",
    );
  });

  it("fully unstages a rename when given both of its paths", async () => {
    await commitInitial();
    await git("mv", "tracked.txt", "renamed.txt");

    await unstageFiles(repo, ["renamed.txt", "tracked.txt"]);

    expect((await git("diff", "--cached", "--name-only")).trim()).toBe("");
    const changes = await getLocalChanges(repo);
    expect(changes.staged).toEqual([]);
    expect(changes.untracked).toEqual(["renamed.txt"]);
    expect(changes.unstaged.map((file) => file.path)).toContain("tracked.txt");
  });
});

describe("commitChanges", () => {
  it("commits the index and leaves unstaged work behind", async () => {
    await commitInitial();
    await write("tracked.txt", "staged\n");
    await git("add", "tracked.txt");
    await write("other.txt", "untracked, must survive\n");

    const result = await commitChanges(repo, "feat: a subject\n\nA body.");

    expect(result.subject).toBe("feat: a subject");
    expect(await git("log", "-1", "--format=%s")).toBe("feat: a subject\n");
    expect(await git("log", "-1", "--format=%b")).toBe("A body.\n\n");
    // Never "commit -a": the file list is the record of what gets committed.
    expect(exists("other.txt")).toBe(true);
  });

  it("refuses an empty message instead of letting git open an editor", async () => {
    await commitInitial();
    await write("tracked.txt", "staged\n");
    await git("add", "tracked.txt");

    await expect(commitChanges(repo, "   ")).rejects.toThrow(
      /needs a message/i,
    );
  });

  it("surfaces git's own words when a commit is rejected", async () => {
    await commitInitial();

    // Nothing staged. git explains that; swallowing it would leave the user
    // staring at a button that silently does nothing.
    await expect(commitChanges(repo, "chore: nothing")).rejects.toThrow(
      /nothing to commit/i,
    );
  });
});
