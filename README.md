<div align="center">

<img src="resources/icon.png" width="96" height="96" alt="Copper logo" />

# Copper

**A desktop application for guided, agent-assisted code review.**

Replace GitHub's flat file dump with a structured, narrative review experience powered by local Git context and Claude.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-43-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Chakra UI](https://img.shields.io/badge/Chakra_UI-v3-319795?logo=chakraui&logoColor=white)](https://chakra-ui.com/)

</div>

---

## Overview

Reviewing pull requests on GitHub often feels like sifting through an unordered stack of files. Pull request descriptions are frequently sparse, alphabetical file lists hide the flow of execution, and answering simple architectural questions requires switching back to a terminal or local editor.

**Copper** is a desktop application built to make code reviews clear, thorough, and efficient. It connects directly to your GitHub repositories and local checkouts, using Claude to guide you through complex changes in logical order.

### The Trust Principle

> **Every agent claim links directly to exact diff lines.**
>
> Summaries and findings are verified in one click. An ungrounded claim leads to rubber-stamping bad code. Copper never posts comments automatically: the agent suggests, and the human decides.

---

## Key Features

### 1. Guided Review & Logical Change Groups
- **Narrative order:** The diff splits into logical chunks (for example: database migrations, API changes, test updates) rather than a flat alphabetical list.
- **Risk classification:** Each change group receives an attention, routine, or mechanical badge.
- **Reading tour:** Follow changes in the order they make sense to evaluate.

### 2. Multi-Perspective Summaries
- **Summary lenses:** Switch between high-level overviews, risk assessments, caller behavior changes, and out-of-scope notes.
- **Review personalities:** Choose the voice of the analysis, including Concise, Technical, Mentor, and ASD-STE100 Simplified Technical English.
- **Fast and cached:** Analyses cache to disk and link to the commit SHA, preventing repeated API costs for the same revision.

### 3. Pre-Review Agent Findings (Blast Radius Analysis)
- **Deep inspection:** An agentic tool loop examines code outside the diff.
- **Call-site verification:** Detects callers affected by function or signature changes that were omitted from the pull request.
- **Verified findings vs. cleared risks:** Confirms or dismisses preliminary risks with concrete evidence.
- **Actionable output:** Copy findings as formatted Markdown diff snippets or draft them immediately as review comments.

### 4. Full-Repo Q&A Chat
- **Deep repository awareness:** Ask questions about any part of the pull request or codebase.
- **Local repository tools:** Claude inspects the repo using `read_file`, `list_files`, `grep_repo`, and `git_log` against a bare blobless clone.
- **Prompt cached & streamed:** Context is cached for rapid follow-up questions with live streaming responses.

### 5. High-Fidelity Diff Viewer
- **TextMate syntax highlighting:** Powered by Shiki with full support for TypeScript, JSX, TSX, and dozens of languages.
- **Custom themes:** Select separate syntax themes for light and dark modes from more than 60 bundled VS Code themes.
- **Flexible layouts:** Toggle between unified (inline) and split (side-by-side) views, or select dynamic mode.
- **Gap expansion & whole-file view:** Expand context lines between hunks or inspect the entire file at that commit.
- **Bi-directional viewed status:** File view states synchronize directly with GitHub.

### 6. Review & GitHub Collaboration
- **Inline discussions:** Click or drag lines in the diff gutter to create comments.
- **Local review drafts:** Batch comments into a single review (Approve, Request Changes, or Comment) stored locally until submission.
- **Reaction bar:** View and toggle emoji reactions on discussion threads.
- **PR management:** Assign reviewers, update assignees, change the base branch, or merge pull requests.

### 7. Local Changes & Worktrees
- **Pre-PR reviews:** Inspect uncommitted staged and unstaged work in your local checkouts and git worktrees.
- **Local git actions:** Stage, unstage, safely discard changes, craft commits, and push branches directly.
- **Fast porcelain status:** Real-time change counts keep track of modified files across worktrees.

### 8. Multi-Tab Desktop Navigation
- **Persistent tabs:** Keep multiple pull requests, repository issues, and local worktrees open simultaneously.
- **Collapsible sidebar:** Access review requests, authored pull requests, and analyzed history across registered repositories.
- **Global hotkeys:** Navigate tabs and toggle panels using standard desktop keyboard shortcuts.

---

## Security & Privacy

- **Encrypted credential storage:** GitHub tokens and Claude API keys are stored securely using Electron's `safeStorage` (backed by the macOS Keychain).
- **Process isolation:** Secrets remain in the Node.js main process and are never sent to the renderer window.
- **Local blobless clones:** Clones are stored under `~/.pr-reviewer/repos` using `--filter=blob:none`, fetching objects lazily on demand.

---

## Tech Stack

- **Runtime:** [Electron](https://www.electronjs.org/) (Node.js main process, Chromium renderer)
- **UI Framework:** [React 19](https://react.dev/) with [Chakra UI v3](https://chakra-ui.com/) and [Emotion](https://emotion.sh/)
- **Data & State Management:** [TanStack Query v5](https://tanstack.com/query) with disk persistence, [Zustand](https://github.com/pmndrs/zustand)
- **Syntax Highlighting:** [Shiki](https://shiki.style/) (TextMate grammars)
- **AI & LLM Integration:** Anthropic Messages API, Claude Agent SDK
- **Tooling & Build:** [electron-vite](https://electron-vite.org/), [Vite 7](https://vitejs.dev/), [Biome](https://biomejs.dev/)

---

## Getting Started

### Prerequisites

- **macOS** (Apple Silicon arm64 recommended; Intel supported)
- **Node.js** >= 20
- **pnpm** >= 9 (or 10)
- **Git**

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/jamesofficer/reviewr.git
   cd reviewr
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the application in development mode:
   ```bash
   pnpm dev
   ```

### Configuration

Open the Settings dialog via the gear icon in the bottom-left sidebar (or press `Cmd+,` / `Ctrl+,`):

1. **GitHub Token:** Provide a GitHub Personal Access Token (classic token with `repo` scope, or fine-grained token with Pull Requests, Issues, and Repository Contents permissions).
2. **Claude API Key:** Provide an Anthropic API key from [console.anthropic.com](https://console.anthropic.com/).
3. *(Optional)* **GitHub Session:** Connect a browser session to support uploading comment attachments (images and screen recordings).

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Starts the app in development mode with hot reloading |
| `pnpm build` | Compiles both main and renderer TypeScript bundles |
| `pnpm typecheck` | Runs TypeScript type checking on both Node and Web projects |
| `pnpm test` | Runs test suites with Vitest |
| `pnpm check` | Runs Biome to format code, check lint rules, and organize imports |
| `pnpm dist` | Packages the application into a macOS DMG installer |

---

## Keyboard Shortcuts

| Shortcut (macOS / Linux, Windows) | Action |
|---|---|
| <kbd>⌘</kbd> + <kbd>B</kbd> / <kbd>Ctrl</kbd> + <kbd>B</kbd> | Toggle sidebar visibility |
| <kbd>⌘</kbd> + <kbd>W</kbd> / <kbd>Ctrl</kbd> + <kbd>W</kbd> | Close active tab |
| <kbd>Ctrl</kbd> + <kbd>Tab</kbd> | Switch to next tab |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Tab</kbd> | Switch to previous tab |
| <kbd>⌘</kbd> + <kbd>1</kbd> ... <kbd>8</kbd> | Select tab by index |
| <kbd>⌘</kbd> + <kbd>9</kbd> | Select last tab |
| <kbd>⌘</kbd> + <kbd>Enter</kbd> / <kbd>Ctrl</kbd> + <kbd>Enter</kbd> | Submit comment or commit staged changes |
