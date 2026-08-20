import { z } from "zod";
import type { PullRequest } from "../../../../shared/types";

// The tabs that the app has open, and the pure functions that change them.
//
// This file has no React code and no side effects. Each function receives the
// tabs state and returns a new state. useTabs.ts adds Zustand and writes the
// state to disk.

// The three panes of the review screen. This file holds the type, and
// screens/Review.tsx gets it from here. A file in lib must not import a
// screen.
export type ReviewTab = "overview" | "changes" | "review";

// The id of the first tab. That tab shows the repository queue: the open pull
// requests, the issues and the current changes. There is always one queue tab.
// The user cannot close it, because it is the way back to the lists.
export const QUEUE_TAB_ID = "queue";

// The maximum number of tabs that stay in the DOM. If the user returns to a
// tab that is in the DOM, the tab keeps its scroll position and its open diff
// sections. If the user returns to a different tab, that tab shows data from
// the TanStack Query cache immediately, but it starts at the top.
//
// The limit is necessary. Each tab in the DOM holds all of its highlighted
// diff. Four large pull requests in split view make too many nodes.
export const MAX_LIVE_TABS = 3;

// The state that a pull request tab keeps while it is not in the DOM. All of
// these values are simple, because the store writes them to disk as JSON. The
// scroll position and the open diff sections are DOM state. MAX_LIVE_TABS
// keeps those instead.
export interface PrTabUi {
  tab: ReviewTab;
  selectedPath: string | null;
  selectedCommit: string | null;
  fileFilter: string;
  chatCollapsed: boolean;
}

export interface QueueTab {
  id: typeof QUEUE_TAB_ID;
  kind: "queue";
}

export interface PrTab {
  id: string;
  kind: "pr";
  // A copy of the pull request data, made when the user opened the tab. The
  // tab bar uses it for the title, the number and the draft mark. The query
  // cache holds the data that the screen shows. Thus old data in this copy
  // cannot put old data on the screen.
  pr: PullRequest;
  ui: PrTabUi;
}

export interface LocalChangesTab {
  id: string;
  kind: "localChanges";
  // The repository, and the checkout that this tab shows. A repository can
  // have more than one linked worktree, and each worktree gets its own tab.
  // The worktree path is the key for all of the local-changes queries. The
  // repository path tells the sidebar which row to mark.
  repoPath: string;
  worktreePath: string;
  // The text on the tab. The worktree query gives the branch name later, so
  // the caller supplies the best text that it has now.
  title: string;
}

export type Tab = QueueTab | PrTab | LocalChangesTab;

// The tabs state. `tabs` is the row, and the queue tab is always first.
// `activeId` is the tab that the window shows. `mru` holds the tab ids, most
// recent first: it selects the tabs that stay in the DOM. `mru` does not
// control the keyboard shortcuts, because those move along the row, and the
// row is what the user sees.
export interface TabsData {
  tabs: Tab[];
  activeId: string;
  mru: string[];
}

// The id of a tab comes from its content. Thus, if the user opens a pull
// request that is already open, the app finds the same tab again. It does not
// make a second tab for the same pull request.
export function prTabId(repo: string, prNumber: number): string {
  return `pr:${repo}#${prNumber}`;
}

export function localChangesTabId(worktreePath: string): string {
  return `local:${worktreePath}`;
}

export function defaultPrTabUi(tab: ReviewTab = "overview"): PrTabUi {
  return {
    tab,
    selectedPath: null,
    selectedCommit: null,
    fileFilter: "",
    chatCollapsed: false,
  };
}

const queueTab: QueueTab = { id: QUEUE_TAB_ID, kind: "queue" };

export function initialTabsState(): TabsData {
  return { tabs: [queueTab], activeId: QUEUE_TAB_ID, mru: [QUEUE_TAB_ID] };
}

function promote(mru: readonly string[], id: string): string[] {
  return [id, ...mru.filter((entry) => entry !== id)];
}

// If the user closes the active tab, the tab on the right becomes active. At
// the end of the row, the tab on the left becomes active. Browsers and editors
// use the same rule. It makes a sequence of closes easy to predict.
function neighbourOf(tabs: readonly Tab[], index: number): string {
  return (tabs[index + 1] ?? tabs[index - 1] ?? queueTab).id;
}

// Selects the tabs that stay in the DOM: the active tab first, then the most
// recent tabs, up to the limit. The function is pure, so a test can check the
// limit without a component. App can also give it to a `useShallow` selector.
export function pickLiveTabIds(
  mru: readonly string[],
  activeId: string,
  limit: number = MAX_LIVE_TABS,
): string[] {
  const live = [activeId];
  for (const id of mru) {
    if (live.length >= limit) break;
    if (!live.includes(id)) live.push(id);
  }
  return live;
}

export function openPullRequest(
  state: TabsData,
  pr: PullRequest,
  tab: ReviewTab = "overview",
): TabsData {
  const id = prTabId(pr.repo, pr.number);
  const isOpen = state.tabs.some((entry) => entry.id === id);
  return {
    // If the tab is already open, show the pane that the caller asks for. A
    // user who clicks "Review changes" wants the diff. Do not show the pane
    // that the user left before.
    tabs: isOpen
      ? state.tabs.map((entry) =>
          entry.id === id && entry.kind === "pr"
            ? { ...entry, ui: { ...entry.ui, tab } }
            : entry,
        )
      : [...state.tabs, { id, kind: "pr", pr, ui: defaultPrTabUi(tab) }],
    activeId: id,
    mru: promote(state.mru, id),
  };
}

export function openLocalChanges(
  state: TabsData,
  args: { repoPath: string; worktreePath: string; title: string },
): TabsData {
  const id = localChangesTabId(args.worktreePath);
  const isOpen = state.tabs.some((entry) => entry.id === id);
  return {
    tabs: isOpen
      ? state.tabs
      : [...state.tabs, { id, kind: "localChanges", ...args }],
    activeId: id,
    mru: promote(state.mru, id),
  };
}

export function activateTab(state: TabsData, id: string): TabsData {
  // Check the id before you use it. A keyboard shortcut or a sidebar row can
  // give the id of a tab that is now closed. An unknown id must not make the
  // window empty.
  if (!state.tabs.some((entry) => entry.id === id)) return state;
  return { ...state, activeId: id, mru: promote(state.mru, id) };
}

// Moves along the row by `delta` steps. The move continues from the last tab
// to the first, and from the first tab to the last.
export function activateOffset(state: TabsData, delta: number): TabsData {
  const index = state.tabs.findIndex((entry) => entry.id === state.activeId);
  if (index === -1) return state;
  const next = (index + delta + state.tabs.length) % state.tabs.length;
  return activateTab(state, state.tabs[next].id);
}

// Selects a tab by its position. The count starts at 0, and the queue tab is
// at 0. An index after the end selects the last tab, because Cmd+9 selects the
// last tab in other applications.
export function activateIndex(state: TabsData, index: number): TabsData {
  const target = state.tabs[Math.min(index, state.tabs.length - 1)];
  return target ? activateTab(state, target.id) : state;
}

export function closeTab(state: TabsData, id: string): TabsData {
  // The queue tab has no close button. It also ignores a close from any other
  // part of the app.
  if (id === QUEUE_TAB_ID) return state;
  const index = state.tabs.findIndex((entry) => entry.id === id);
  if (index === -1) return state;
  return {
    tabs: state.tabs.filter((entry) => entry.id !== id),
    activeId:
      state.activeId === id ? neighbourOf(state.tabs, index) : state.activeId,
    mru: state.mru.filter((entry) => entry !== id),
  };
}

export function closeOthers(state: TabsData, id: string): TabsData {
  if (!state.tabs.some((entry) => entry.id === id)) return state;
  const tabs = state.tabs.filter(
    (entry) => entry.id === id || entry.id === QUEUE_TAB_ID,
  );
  const keep = new Set(tabs.map((entry) => entry.id));
  return {
    tabs,
    activeId: id,
    mru: promote(
      state.mru.filter((entry) => keep.has(entry)),
      id,
    ),
  };
}

export function moveTab(
  state: TabsData,
  id: string,
  toIndex: number,
): TabsData {
  if (id === QUEUE_TAB_ID) return state;
  const from = state.tabs.findIndex((entry) => entry.id === id);
  if (from === -1) return state;
  const tabs = [...state.tabs];
  const [moved] = tabs.splice(from, 1);
  // The queue tab stays first. If the user drops a tab on the left edge, the
  // tab goes next to the queue tab. It does not replace the queue tab.
  const to = Math.min(Math.max(toIndex, 1), tabs.length);
  tabs.splice(to, 0, moved);
  return { ...state, tabs };
}

export function setPrUi(
  state: TabsData,
  id: string,
  patch: Partial<PrTabUi>,
): TabsData {
  return {
    ...state,
    tabs: state.tabs.map((entry) =>
      entry.id === id && entry.kind === "pr"
        ? { ...entry, ui: { ...entry.ui, ...patch } }
        : entry,
    ),
  };
}

// An earlier version of the app can write a tab in a different shape, and the
// app must still start. These schemas check each tab separately, and `parse`
// removes a tab that it cannot read. The loss of one tab is better than the
// loss of all of the tabs.
const prSnapshotSchema = z.looseObject({
  repo: z.string(),
  number: z.number(),
  title: z.string(),
});

const prTabUiSchema = z.object({
  tab: z.enum(["overview", "changes", "review"]).catch("overview"),
  selectedPath: z.string().nullable().catch(null),
  selectedCommit: z.string().nullable().catch(null),
  fileFilter: z.string().catch(""),
  chatCollapsed: z.boolean().catch(false),
});

const tabSchema = z.discriminatedUnion("kind", [
  z.object({ id: z.literal(QUEUE_TAB_ID), kind: z.literal("queue") }),
  z.object({
    id: z.string(),
    kind: z.literal("pr"),
    pr: prSnapshotSchema,
    ui: prTabUiSchema.catch(defaultPrTabUi()),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("localChanges"),
    repoPath: z.string(),
    worktreePath: z.string(),
    title: z.string(),
  }),
]);

const persistedSchema = z.object({
  tabs: z.array(z.unknown()).catch([]),
  activeId: z.string().catch(QUEUE_TAB_ID),
  mru: z.array(z.string()).catch([]),
});

export function parse(persisted: unknown): TabsData {
  const outer = persistedSchema.safeParse(persisted);
  if (!outer.success) return initialTabsState();

  const tabs: Tab[] = [queueTab];
  const seen = new Set<string>([QUEUE_TAB_ID]);
  for (const candidate of outer.data.tabs) {
    const result = tabSchema.safeParse(candidate);
    // This function adds the queue tab first, so a stored queue tab is a
    // duplicate.
    if (!result.success || seen.has(result.data.id)) continue;
    seen.add(result.data.id);
    // The schema checks only the fields that the tab bar shows. A check of all
    // of the PullRequest fields would remove the tab after someone adds a new
    // field. The screen gets its data from the query cache. Thus the type cast
    // is safe.
    if (result.data.kind !== "queue") tabs.push(result.data as Tab);
  }

  const activeId = seen.has(outer.data.activeId)
    ? outer.data.activeId
    : QUEUE_TAB_ID;
  // A tab that is present but has no place in the order needs one. Without a
  // place, the tab can never stay in the DOM.
  const mru = promote(
    [...outer.data.mru.filter((id) => seen.has(id)), ...seen],
    activeId,
  ).filter((id, index, all) => all.indexOf(id) === index);

  return { tabs, activeId, mru };
}
