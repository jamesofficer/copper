# Plan: Explain a selection (drag-to-explain) — roadmap item 7

Status: **planned, not started.** Captured 2026-07-24 after a codebase exploration. We may
tackle other work before this — this doc is the pick-up-where-we-left-off reference.

**Progress:**
- The shared JSON-store helper (`main/store/jsonStore.ts`) landed 2026-07-24 as a warm-up, and
  `store/drafts.ts` was refactored onto it.
- **Phase 1 (core loop) is built** on branch `jo/feat/drag-to-explain` (2026-07-24). Drag a
  range on the Changes-tab diff → the composer now offers **Explain** alongside Comment → the
  agent answers one-shot (not saved to chat) → a local-only "AI explanation" card renders under
  the lines as a third band, with delete. Typecheck + build pass; not yet manually run.
  Phases 2 (staleness) and 3 (bridges) are still to do.

See the roadmap item 7 description in `CLAUDE.md` for the product intent. This doc records
the implementation findings and the build plan.

## The feature in one line

On the Changes-tab diff, drag-select a line range and choose **Explain** (alongside the
existing **Comment**). The selected lines go to the Q&A agent, and the answer renders as a
local-only "AI explanation" card anchored under those lines — never posted to GitHub.

## Do we need SQLite (roadmap item 3) first? No.

Item 3 is **not** a prerequisite. Build item 7 on the existing JSON-store pattern.

- `store/db.ts` is a 4-line throwing stub, imported nowhere, and there's no SQLite driver in
  the dependencies. Item 3 is greenfield, not half-built.
- Every store is hidden behind plain function exports (`listDraftComments`,
  `getCachedFindings`, …). Callers never touch the file format. No cross-store relationships —
  each key is a self-contained string (`repo#number`, `repo#pr@sha`).
- So adding `explanations.json` now is nearly free (copy `store/drafts.ts`, ~110 lines) and
  creates no lock-in. A future SQLite migration is already a per-store job; explanations would
  be one more table swapped independently.

The one real thing SQLite would fix is durability — the older stores do a full-file overwrite
with no atomic rename, and a corrupt file is silently read as "no data." The shared
`createJsonStore` helper now closes the atomic-write half of that for any store that adopts it
(temp file + rename). `drafts.ts` is on it; `cache.ts`, `findings.ts`, and `session.ts` are
easy follow-ups. That leaves SQLite as an optional later consolidation, not a blocker.

## What already exists (this feature is mostly assembly)

| Need | Already built | Where |
|---|---|---|
| Drag-select a line range on the diff | Full selection machine: `SelectionRange`, `startSelect`/`extendSelect`, same-side/same-hunk enforcement; on mouse-up hands you `{ side, line, startLine }` | `components/DiffLines.tsx` (state `:583-587`, gesture `:855-880`, composer payload `:802-809`) |
| Render cards anchored under a diff line | `DiffCommenting` carries two "bands" today (real threads + local drafts); `CommentBands` is the single render point for inline **and** split views | `DiffLines.tsx` `DiffCommenting` `:39-52`, `CommentBands` `:297-346` |
| Ask the AI with full PR context | `askQuestion` IPC — diff + cached analysis auto-attached; repo tools scoped to head commit | `main/agent/session.ts:313-349`, context `:92-112` |
| Hand a selection to the agent as a prompt | `AskContext` + `buildQuestionWithContext` already serialize "here are some lines, answer about them" (used by "Ask about this") | `renderer/src/lib/askContext.ts` (`:7-22`, `:55-68`) |
| Promote to a draft review comment | `addDraftComment` — exactly the call the bridge needs | `DiffCommentComposer.tsx:65-82`, store `main/store/drafts.ts:50-69` |
| Staleness / anchor re-validation | `validNewLines` + snap-to-nearest + head-SHA comparison, ready to reuse | `main/analysis/findingsNormalize.ts` (`validNewLines` `:33-50`, `nearest` `:52-59`) |

## What's actually new

1. **A new store** — `main/store/explanations.ts`, built on the shared
   `createJsonStore` helper (`main/store/jsonStore.ts`), keyed `repo#number`. The helper owns
   the load/persist/atomic-write boilerplate, so the file is just the domain logic: a key
   helper + CRUD. Each entry: `id`, `path`, line range + `side`, answer markdown, the **head
   SHA it was generated against**, and a snapshot of the explained code (for staleness). Add an
   `Explanation` type to `shared/types.ts` (anchor shape can follow `DraftReviewComment`:
   `{ path, side, line, startLine }`).

2. **~4 IPC methods** — `listExplanations`, `addExplanation`, `deleteExplanation`,
   `updateExplanation` (for re-explain). Each touches the same 4 sites: `shared/ipc.ts`
   (interface + channels array), `main/ipc/router.ts` (handler), `preload/index.ts` (bridge).
   The router's handler-registration loop is generic, so no extra wiring per method.

3. **An ephemeral agent call** — today *every* `askQuestion` writes to `chats.json`
   (`session.ts:338-346`). A one-shot explanation shouldn't pollute the chat. Add a
   `persist: false` option to `askQuestion` (pass `[]` history, skip the save block), or a
   sibling `explainSelection`. The roadmap keeps v1 explanations single-shot, so this stays
   simple.

4. **The "Explain" action** — a second button alongside "Comment"/"Start a review" when a
   selection's composer opens. The composer payload (`ctx.composer`, `DiffLines.tsx:802-809`)
   already carries the exact `side`/`line`/`startLine` an explain request needs.

5. **A third band** — extend `DiffCommenting` with `explanations[]`, add an
   `explanationsByKey` lookup + `explanationsFor(line)` accessor (mirror `draftsByKey`
   `:718-727`), and render a new `AiExplanationCard` (sparkle icon, accent tint, no
   "post to GitHub" action) inside `CommentBands` (`:297-346`). Assemble the data + callbacks
   in `ChangesView.tsx`'s `commenting` memo (`:181-205`). The only fiddly part is the
   split-view segment loop (`DiffLines.tsx:506-524`), which cuts the two-column layout so a
   full-width band can span it — gather per-segment explanations there too.

## Build order (three phases)

### Phase 1 — core loop (read-only, delivers the feature on its own) — DONE
Selection → "Explain" → ephemeral agent call → inline AI explanation card → persist to
`explanations.json` → render as the third band. Built as described; the "spinner" is a loading
state on the composer's Explain button (the composer stays open until the answer returns, then
the card appears) — no token-streaming for v1, so it never collides with the chat stream. The
agent path (`askViaApi`/`askViaClaudeCode`) was refactored to take an `onText` callback;
`explainSelection` passes a no-op so it produces no chat chunks at all.

### Phase 2 — staleness
On load, re-validate each anchor against the current diff and compare the code snapshot; if
the lines changed, keep the card but badge it "explains an earlier version" with one-click
**Re-explain** + **Dismiss**. Local-only, so be forgiving — badge, never auto-delete.

### Phase 3 — bridges out
- **Promote to draft comment** — cheap; reuses `addDraftComment` verbatim.
- **Continue in chat** — the one genuinely cross-cutting change. The Changes tab and Review
  tab don't share state, and the tab shell (`screens/Review.tsx:103-134`) is *uncontrolled*.
  Needs `activeTab` + a chat seed lifted into `Review.tsx` (make the tabs controlled via
  `value`/`onValueChange`), threaded down through `ReviewPanel` → `ChatPanel` via the existing
  `askRequest` prop (`ReviewPanel.tsx:70,78-81,300-305`; `ChatPanel.tsx:111-119`). Extend
  `AskContext.label` to include a "selection" kind.

## Open decisions / risks

- **Streaming vs spinner for the card.** The `chatChunk` channel is keyed only by
  `repo`/`prNumber` with no per-request id (`shared/ipc.ts:211-217`), so a concurrent chat
  answer and explanation on the same PR would interleave. For v1, skip delta streaming on the
  card and use `askQuestion`'s Promise return + a spinner. Streaming the card is later polish
  that needs an id/kind added to `ChatChunk`.
- **Ephemeral mode shape** — a `persist` flag on `askQuestion` (minimal) vs a sibling
  `explainSelection` method (cleaner separation, more boilerplate). Lean toward the flag.
- **Split-view band plumbing** is the fiddliest UI bit; everything else is well-trodden.

## Key files to touch

- `main/store/jsonStore.ts` — shared `createJsonStore` helper (done).
- `main/store/explanations.ts` (new) — domain logic on top of `createJsonStore`, like
  the refactored `store/drafts.ts`.
- `shared/types.ts` — `Explanation` type.
- `shared/ipc.ts`, `main/ipc/router.ts`, `preload/index.ts` — the ~4 IPC methods.
- `main/agent/session.ts` — ephemeral (`persist: false`) mode on `askQuestion`.
- `renderer/src/components/DiffLines.tsx` — `DiffCommenting.explanations`, `explanationsFor`,
  render in `CommentBands`, split-segment gathering, "Explain" action.
- `renderer/src/components/AiExplanationCard.tsx` (new) — the card.
- `renderer/src/components/ChangesView.tsx` — wire data + callbacks into the `commenting` memo.
- `renderer/src/lib/askContext.ts` — extend for the "selection" hand-off (phase 3).
- `renderer/src/screens/Review.tsx`, `components/ReviewPanel.tsx`, `components/ChatPanel.tsx` —
  controlled tabs + chat seed for "Continue in chat" (phase 3).
