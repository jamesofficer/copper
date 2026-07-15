import {
  fetchPullRequestRef,
  grepAtCommit,
  hasCommit,
  listFiles,
  logForPath,
  showFile,
} from "../repo/git";
import { ensureFullClone, ensureRepo } from "../repo/workspace";

const MAX_FILE_LINES = 2000;
const MAX_TEXT = 40_000;
const MAX_LIST = 1000;

export interface ToolContext {
  repo: string;
  prNumber: number;
  headSha: string;
}

export const chatTools = [
  {
    name: "read_file",
    description:
      "Read a file from the repository at the commit under review. Returns the file content with line numbers.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Repository-relative file path, e.g. src/main/index.ts",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "list_files",
    description:
      "List file paths in the repository at the commit under review, optionally only under a directory.",
    input_schema: {
      type: "object",
      properties: {
        directory: {
          type: "string",
          description: "Only list files under this directory, e.g. src/lib",
        },
      },
      required: [],
    },
  },
  {
    name: "grep_repo",
    description:
      "Search file contents across the repository at the commit under review. Pattern is a case-sensitive extended regex (POSIX ERE). Returns path:line:content matches.",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Extended regex to search for",
        },
        directory: {
          type: "string",
          description: "Limit the search to this directory",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "git_log",
    description:
      "Recent commit history leading up to the commit under review, optionally for a single file path.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Repository-relative file path",
        },
        limit: {
          type: "number",
          description: "Maximum commits to return (default 20, max 50)",
        },
      },
      required: [],
    },
  },
];

function stringArg(
  input: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function clamp(text: string, note: string): string {
  if (text.length <= MAX_TEXT) return text;
  return `${text.slice(0, MAX_TEXT)}\n… [truncated: ${note}]`;
}

async function workspaceFor(ctx: ToolContext): Promise<string> {
  const dir = await ensureRepo(ctx.repo);
  if (!(await hasCommit(dir, ctx.headSha))) {
    await fetchPullRequestRef(dir, ctx.prNumber);
    if (!(await hasCommit(dir, ctx.headSha))) {
      throw new Error(
        "The repository workspace doesn't have the reviewed commit. Answer from the diff instead.",
      );
    }
  }
  return dir;
}

export async function runTool(
  ctx: ToolContext,
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  const dir = await workspaceFor(ctx);

  switch (name) {
    case "read_file": {
      const path = stringArg(input, "path");
      if (!path) throw new Error("read_file requires a path.");
      const content = await showFile(dir, ctx.headSha, path);
      const lines = content.split("\n");
      const numbered = lines
        .slice(0, MAX_FILE_LINES)
        .map((line, index) => `${index + 1}\t${line}`)
        .join("\n");
      const suffix =
        lines.length > MAX_FILE_LINES
          ? `\n… [truncated: file has ${lines.length} lines]`
          : "";
      return clamp(numbered, "long file") + suffix;
    }

    case "list_files": {
      const directory = stringArg(input, "directory");
      const all = await listFiles(dir, ctx.headSha);
      const prefix = directory ? `${directory.replace(/\/+$/, "")}/` : null;
      const matched = prefix
        ? all.filter((path) => path.startsWith(prefix))
        : all;
      if (matched.length === 0) return "No files found.";
      const shown = matched.slice(0, MAX_LIST);
      const note =
        matched.length > shown.length
          ? `\n… [${matched.length - shown.length} more files not shown]`
          : "";
      return shown.join("\n") + note;
    }

    case "grep_repo": {
      const pattern = stringArg(input, "pattern");
      if (!pattern) throw new Error("grep_repo requires a pattern.");
      await ensureFullClone(ctx.repo);
      const out = await grepAtCommit(
        dir,
        ctx.headSha,
        pattern,
        stringArg(input, "directory"),
      );
      return out ? clamp(out, "many matches") : "No matches.";
    }

    case "git_log": {
      const rawLimit = input.limit;
      const limit =
        typeof rawLimit === "number"
          ? Math.min(Math.max(1, Math.floor(rawLimit)), 50)
          : 20;
      const out = await logForPath(
        dir,
        ctx.headSha,
        stringArg(input, "path"),
        limit,
      );
      return out.trim() || "No commits found.";
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
