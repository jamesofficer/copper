# PR Reviewer

A desktop app that makes code review easier. Think of it as replacing GitHub's "manila folder dump" of files with a guided, agent-assisted review experience.

## The problem

- PR descriptions are often obtuse, empty, or don't explain what the PR is trying to achieve.
- Reviewing means scrolling a big unordered file list. No signal for how data flows, which changes are critical, or where to start.
- No way to ask questions about the code without interrupting the author.

## What the app does

1. **Agent-generated summaries with lenses.** When a PR is opened, an agent produces toggleable views: overview ("what changed and why"), risks, behavior changes (what callers/users experience differently), and scope ("what's NOT in this PR").
2. **Logical change groups + reading order.** The diff is split into narrative chunks ("Change 1: new endpoint, 3 files. Change 2: mechanical rename, 12 files"), each with a risk badge, presented as a guided tour rather than a flat file list.
3. **Q&A agent with full repo context.** Ask questions about specific changes or the whole PR. The agent has the entire repo cloned locally (not just the diff), so it can answer "what does this helper do?" and "who else calls this?".

Planned beyond MVP:

- **Blast radius**: for changed functions/signatures, find callers *outside* the diff that weren't updated — that's where bugs live.
- **Risk-ranked file ordering**: new logic > modified logic > mechanical renames > generated files > lockfiles.
- **Pre-review agent pass**: candidate issues flagged as suggestions for the human to verify, not auto-comments.
- **Diff vs. intent check**: does the PR do what its description/ticket says, and nothing surprising?
- **Changes since last review**: for repeat rounds, summarize what changed and how comments were addressed.
- **Comment drafting**: draft inline comments locally (agent can help phrase), batch-submit as a real GitHub review.

Trust principle: every agent claim must link to the exact lines it's based on, so verification is one click. A reviewer who trusts a wrong summary rubber-stamps a bad PR.

## Architecture

Electron (chosen over Tauri because the Claude Agent SDK, Octokit, and git tooling are all Node/TypeScript — Electron's main process runs them natively; Tauri would need a Node sidecar).

- **Main process (Node)** — all the real work: GitHub API (Octokit), local repo clones under `~/.pr-reviewer/repos` (blobless: `--filter=blob:none`), diff parsing, the analysis pipeline, Claude Agent SDK sessions, SQLite persistence. Secrets never reach the renderer.
- **Renderer (React + Chakra UI v3)** — purely presentational. Welcome screen: centered repo switcher (local git folders picked via the native directory dialog) with the repo's open PRs listed underneath. Review screen: change groups (left), diff viewer (center), summary lenses + chat (right). Theme lives in `src/renderer/src/theme.ts` (dark mode forced via `class="dark"` on `<html>`, purple accent, mono type for slugs/PR numbers/diff stats).
- **Typed IPC** — `src/shared/ipc.ts` defines the `IpcApi` interface. `src/main/ipc/router.ts` implements it; `src/preload/index.ts` exposes it as `window.api`. To add an IPC call, add a method to `IpcApi` and the compiler forces implementations on both sides. `src/shared/types.ts` is the single source of truth for data shapes.

### Analysis pipeline (design)

On opening a PR: sync repo → check cache (keyed by repo + PR + head SHA) → parse diff structurally (fast, no AI; mechanical files like lockfiles classified cheaply) → agent passes streamed to the UI cheapest-first: grouping/reading order, then summary lenses, then blast radius. Results cached in SQLite so re-opening is instant. Use a cheap model (Haiku) for mechanical classification, a strong model for summaries/risks/chat. Later: background poller pre-analyzes the whole review queue.

## Project structure

```
src/
├── main/
│   ├── index.ts            # app lifecycle, window creation
│   ├── ipc/router.ts       # implements IpcApi, registers ipcMain handlers
│   ├── github/             # auth.ts (OAuth device flow — stub), client.ts (Octokit — MOCK DATA)
│   ├── repo/               # local.ts (repo registry + folder picker), workspace.ts (stub), git.ts (stub)
│   ├── analysis/           # pipeline.ts (MOCK DATA), diff-parser.ts (stub), cache.ts (in-memory)
│   ├── agent/              # session.ts (Q&A — stub echo)
│   └── store/db.ts         # SQLite — stub
├── preload/                # index.ts (window.api bridge), index.d.ts (Window typing)
├── renderer/src/           # App.tsx, theme.ts, screens/Welcome.tsx, screens/Review.tsx, components/ui/toaster.tsx
└── shared/                 # types.ts, ipc.ts — the contract between processes
```

## Current status (as of 2026-07-14)

Scaffold complete and verified: `pnpm typecheck` and `pnpm build` pass, `pnpm dev` opens the app. The UI is built with Chakra UI v3. Repository management is real: add local git repos via the native folder dialog, the GitHub slug is read from the `origin` remote, and the list persists to `~/.pr-reviewer/repositories.json`. The rest runs on mock data — PR list per repo → open PR → grouped changes with risk badges, summary panel, chat that echoes through IPC. Nothing talks to GitHub or Claude yet.

Roadmap (rough order):

1. Real GitHub: OAuth device flow (`github/auth.ts`, token in keychain) + Octokit review queue (`github/client.ts`).
2. Repo workspace: blobless clone/fetch + PR head refs (`repo/`).
3. Diff parsing + mechanical classification (`analysis/diff-parser.ts`).
4. Analysis pipeline with the Agent SDK: grouping/reading order first, then summary lenses.
5. Q&A agent session with repo tools (read_file, grep_repo, git_log, get_diff) (`agent/session.ts`).
6. SQLite persistence (`store/db.ts`, replace in-memory `analysis/cache.ts`).
7. Real diff viewer (virtualized, syntax highlighting off the main thread).
8. Comment drafts + batch submit review via Octokit.
9. Blast radius and the other post-MVP features.

## Development

- `pnpm dev` — run the app. `pnpm typecheck` — both tsconfig projects. `pnpm build` — production build.
- `pnpm format` — Biome formatter (write). `pnpm lint` — Biome linter (check only). `pnpm check` — Biome format + lint + import sorting (write). Config in `biome.json`: tabs, double quotes, respects `.gitignore`.
- pnpm 10 blocks dependency install scripts; `electron` and `esbuild` are allowlisted in package.json (`pnpm.onlyBuiltDependencies`). If `node_modules/electron/dist` is missing after install, run `node node_modules/electron/install.js`.
- Pinned: vite 7 + @vitejs/plugin-react 5 (electron-vite 5 doesn't support vite 8 yet).

## Conventions

- UI is Chakra UI v3 (`@chakra-ui/react` + `@emotion/react`, icons from `react-icons/lu`). Use Chakra components and style props, not CSS files. A Chakra MCP server is available for component examples and props.
- React components and functions inside them use the `function` keyword, not arrow functions.
- Component props: `interface Props {}` (or a descriptive exported name if they must be exported).
- No unnecessary comments; TODOs mark unimplemented stubs.
- Formatting and linting are handled by Biome (tabs, double quotes). Run `pnpm check` before committing.
- Conventional commits (`feat:`, `fix:`, `chore:`).
