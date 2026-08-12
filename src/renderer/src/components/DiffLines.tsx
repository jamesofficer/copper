import { Box, Flex, Text } from "@chakra-ui/react";
import {
  Fragment,
  memo,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LuChevronsUpDown, LuPlus } from "react-icons/lu";
import type {
  DiffSide,
  DraftReviewComment,
  Explanation,
  PullRequestFile,
} from "../../../shared/types";
import {
  buildSplitRows,
  computeGaps,
  type DiffLine,
  expandLines,
  highlightToLines,
  type LineKind,
  languageForPath,
  parsePatch,
  type SplitRow,
  TAIL_GAP,
} from "../lib/diffParser";
import { useDiffViewMode } from "../lib/diffViewMode";
import {
  type AnchoredLine,
  type ResolvedExplanation,
  resolveExplanation,
} from "../lib/explanationStatus";
import type { ReviewThread } from "../lib/reviewComments";
import { scrollbar } from "../lib/scrollbar";
import { syntaxBackground, tokenColors } from "../lib/syntaxColors";
import { useSyntaxThemes } from "../lib/syntaxTheme";
import AiExplanationCard from "./AiExplanationCard";
import DiffCommentComposer from "./DiffCommentComposer";
import DiffCommentThread from "./DiffCommentThread";
import DraftCommentCard from "./DraftCommentCard";

// Everything a diff needs to host inline review comments: the file's
// existing threads plus the ids the composer posts new ones with.
export interface DiffCommenting {
  repo: string;
  prNumber: number;
  commitId: string;
  threads: ReviewThread[];
  // Root-comment ids of resolved threads, so each thread's resolve button
  // can read the current state.
  resolvedRootIds: Set<number>;
  // The file's locally drafted review comments, rendered like threads.
  drafts: DraftReviewComment[];
  // True once ANY draft exists on the PR — a review is in progress, which
  // changes the composer's buttons.
  reviewStarted: boolean;
  // The file's local-only AI explanations, rendered as a third band under the
  // lines they anchor to.
  explanations: Explanation[];
}

// Access to the full file at the diff's commit. Enables "expand hidden
// lines" and upgrades added/context-line syntax highlighting from per-hunk
// fragments (which mis-highlight when a hunk starts mid-construct) to slices
// of the whole highlighted file.
export interface DiffExpansion {
  // File text at the diff's commit; null while loading or unavailable.
  fullFile: string | null;
  // Asks the parent to fetch fullFile — called on the first expand click.
  requestFullFile(): void;
}

interface Props {
  file: PullRequestFile;
  // When set, lines grow a hover "+" button for commenting and existing
  // threads render under the lines they anchor to.
  commenting?: DiffCommenting;
  expansion?: DiffExpansion;
}

// "dynamic" mode switches to side-by-side when the diff's container is at
// least this wide.
const SPLIT_MIN_WIDTH = 960;

const rowStyles: Record<LineKind, { bg: string; sign: string }> = {
  add: { bg: "green.subtle/75", sign: "+" },
  del: { bg: "red.subtle/75", sign: "-" },
  context: { bg: "transparent", sign: " " },
  hunk: { bg: "bg.muted", sign: "" },
  meta: { bg: "transparent", sign: "" },
};

// Shared with FileView so the full-file listing matches the diff rows.
export const diffFontStyles = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "14px",
  lineHeight: "1.6",
} as const;

// Marks the lines an existing comment thread covers.
const commentedStripe = "inset 3px 0 0 {colors.yellow.solid}";

// GitHub's anchoring rule: deleted lines belong to the LEFT (old) side of
// the diff, added and context lines to the RIGHT (new) side.
interface CommentAnchor {
  side: DiffSide;
  line: number;
  // Selections can't cross hunk boundaries — GitHub rejects such ranges.
  hunk: number;
}

// An in-progress drag over line numbers, before the composer opens.
interface SelectionRange {
  side: DiffSide;
  start: number;
  end: number;
  hunk: number;
}

// Per-render helpers shared by the inline and split renderers. Built only
// when commenting is enabled.
interface CommentContext {
  repo: string;
  prNumber: number;
  commitId: string;
  path: string;
  composer: {
    side: DiffSide;
    line: number;
    startLine: number | null;
    // The selected lines' text, for the composer's "Explain" action.
    code: string;
  } | null;
  resolvedIds: Set<number>;
  reviewStarted: boolean;
  anchorOf(line: DiffLine): CommentAnchor | undefined;
  threadsFor(line: DiffLine): ReviewThread[];
  draftsFor(line: DiffLine): DraftReviewComment[];
  explanationsFor(line: DiffLine): ResolvedExplanation[];
  // Whether an existing thread's range covers this line — marks the lines a
  // comment was left on.
  isCommented(line: DiffLine): boolean;
  isSelected(line: DiffLine): boolean;
  isComposerLine(line: DiffLine): boolean;
  startSelect(event: React.MouseEvent, anchor: CommentAnchor): void;
  extendSelect(line: DiffLine): void;
  closeComposer(): void;
}

// Per-render expansion helpers shared by the inline and split renderers.
interface ExpandContext {
  // Hidden lines above this hunk header — undefined when nothing to expand.
  hiddenAbove(line: DiffLine): number | undefined;
  expand(line: DiffLine): void;
  // Hidden lines after the last hunk: null = count unknown until the file
  // loads, undefined = nothing there (or already expanded).
  tailHidden: number | null | undefined;
  expandTail(): void;
}

function ExpandButton({
  hidden,
  onExpand,
}: {
  hidden: number;
  onExpand(): void;
}) {
  return (
    <Box
      as="button"
      aria-label={`Show ${hidden} hidden lines`}
      title={`Show ${hidden} hidden lines`}
      px="2"
      color="blue.fg"
      cursor="pointer"
      display="flex"
      alignItems="center"
      _hover={{ bg: "blue.subtle" }}
      onClick={onExpand}
    >
      <LuChevronsUpDown size={14} />
    </Box>
  );
}

// The strip after the last hunk that reveals the rest of the file.
function TailExpandRow({ expand }: { expand: ExpandContext }) {
  return (
    <Flex
      as="button"
      w="full"
      alignItems="center"
      bg="bg.muted"
      color="blue.fg"
      cursor="pointer"
      _hover={{ bg: "blue.subtle" }}
      onClick={expand.expandTail}
    >
      <Box px="2" display="flex" alignItems="center">
        <LuChevronsUpDown size={14} />
      </Box>
      <Text as="span" py="0.5" fontSize="12px">
        {expand.tailHidden === null
          ? "Show lines after the last change"
          : `Show ${expand.tailHidden} more lines`}
      </Text>
    </Flex>
  );
}

function Gutter({ value }: { value: number | null }) {
  return (
    <Text
      as="span"
      w="12"
      flexShrink="0"
      px="2"
      textAlign="right"
      color="fg.subtle"
      userSelect="none"
    >
      {value ?? ""}
    </Text>
  );
}

function Sign({ value }: { value: string }) {
  return (
    <Text
      as="span"
      w="4"
      flexShrink="0"
      textAlign="center"
      color="fg.subtle"
      userSelect="none"
    >
      {value}
    </Text>
  );
}

function CodeText({ html }: { html: string }) {
  return (
    <Text
      as="span"
      flex="1"
      pr="4"
      whiteSpace="pre"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: highlighter output is escaped
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Hover-revealed "+" over the line-number gutter; press it (or drag it
// across lines) to start a comment.
function PlusButton({
  anchor,
  ctx,
}: {
  anchor: CommentAnchor;
  ctx: CommentContext;
}) {
  return (
    <Box
      as="button"
      aria-label="Comment on this line"
      position="absolute"
      left="0.5"
      top="50%"
      transform="translateY(-50%)"
      boxSize="4.5"
      display="flex"
      alignItems="center"
      justifyContent="center"
      rounded="sm"
      bg="blue.solid"
      color="white"
      cursor="pointer"
      opacity="0"
      zIndex="1"
      _groupHover={{ opacity: 1 }}
      onMouseDown={(event) => ctx.startSelect(event, anchor)}
    >
      <LuPlus size={13} strokeWidth={3} />
    </Box>
  );
}

// A full-width strip between diff rows holding a thread or the composer.
// Code rows can be far wider than the pane, so the content sticks to the
// left edge while the diff is scrolled sideways.
function CommentBand({ children }: { children: ReactNode }) {
  return (
    <Box
      borderYWidth="1px"
      bg="bg.subtle"
      px="4"
      py="3"
      fontFamily="body"
      fontSize="sm"
      lineHeight="moderate"
      whiteSpace="normal"
    >
      <Box maxW="2xl" position="sticky" left="0">
        {children}
      </Box>
    </Box>
  );
}

function CommentBands({
  ctx,
  threads,
  drafts,
  explanations,
  composerHere,
}: {
  ctx: CommentContext;
  threads: ReviewThread[];
  drafts: DraftReviewComment[];
  explanations: ResolvedExplanation[];
  composerHere: boolean;
}) {
  return (
    <>
      {threads.map((thread) => (
        <CommentBand key={thread.root.id}>
          <DiffCommentThread
            thread={thread}
            repo={ctx.repo}
            prNumber={ctx.prNumber}
            resolved={ctx.resolvedIds.has(thread.root.id)}
          />
        </CommentBand>
      ))}
      {drafts.map((draft) => (
        <CommentBand key={draft.id}>
          <DraftCommentCard
            draft={draft}
            repo={ctx.repo}
            prNumber={ctx.prNumber}
          />
        </CommentBand>
      ))}
      {explanations.map((resolved) => (
        <CommentBand key={resolved.explanation.id}>
          <AiExplanationCard
            resolved={resolved}
            repo={ctx.repo}
            prNumber={ctx.prNumber}
          />
        </CommentBand>
      ))}
      {composerHere && ctx.composer && (
        <CommentBand>
          <DiffCommentComposer
            repo={ctx.repo}
            prNumber={ctx.prNumber}
            commitId={ctx.commitId}
            path={ctx.path}
            side={ctx.composer.side}
            line={ctx.composer.line}
            startLine={ctx.composer.startLine}
            code={ctx.composer.code}
            reviewStarted={ctx.reviewStarted}
            onClose={ctx.closeComposer}
          />
        </CommentBand>
      )}
    </>
  );
}

function InlineRows({
  lines,
  ctx,
  expand,
  background,
}: {
  lines: DiffLine[];
  ctx?: CommentContext;
  expand?: ExpandContext;
  background: ReturnType<typeof syntaxBackground>;
}) {
  return (
    // minW=max-content: inside a scroll container a block element only gets
    // the visible width, so short rows' backgrounds would stop there when
    // scrolled right. Sizing this to the widest row lets every row fill it —
    // which is also why the theme background is painted here, not on the
    // root: the root stops at the scrollport width and would leave a seam.
    <Box minW="max-content" css={background}>
      {lines.map((line, index) => {
        const style = rowStyles[line.kind];
        const anchor = ctx?.anchorOf(line);
        const selected = ctx?.isSelected(line) ?? false;
        const commented = ctx?.isCommented(line) ?? false;
        const hiddenAbove =
          line.kind === "hunk" ? expand?.hiddenAbove(line) : undefined;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: patch lines have no stable id
          <Fragment key={index}>
            <Flex
              className={anchor ? "group" : undefined}
              position="relative"
              bg={selected ? "blue.subtle" : style.bg}
              boxShadow={commented ? commentedStripe : undefined}
              color={line.kind === "hunk" ? "fg.muted" : "fg"}
              onMouseEnter={anchor ? () => ctx?.extendSelect(line) : undefined}
            >
              {line.kind === "hunk" || line.kind === "meta" ? (
                <>
                  {expand && hiddenAbove !== undefined && (
                    <ExpandButton
                      hidden={hiddenAbove}
                      onExpand={() => expand.expand(line)}
                    />
                  )}
                  <Text as="span" px="3" py="0.5" whiteSpace="pre">
                    {line.text}
                  </Text>
                </>
              ) : (
                <>
                  <Gutter value={line.oldNumber} />
                  <Gutter value={line.newNumber} />
                  <Sign value={style.sign} />
                  <CodeText html={line.html} />
                </>
              )}
              {anchor && ctx && <PlusButton anchor={anchor} ctx={ctx} />}
            </Flex>
            {ctx && (
              <CommentBands
                ctx={ctx}
                threads={ctx.threadsFor(line)}
                drafts={ctx.draftsFor(line)}
                explanations={ctx.explanationsFor(line)}
                composerHere={ctx.isComposerLine(line)}
              />
            )}
          </Fragment>
        );
      })}
      {expand && expand.tailHidden !== undefined && (
        <TailExpandRow expand={expand} />
      )}
    </Box>
  );
}

// One side of a split row. Rows across the two columns must stay the same
// height for alignment, so every cell is a single pre-formatted line.
function SplitCell({
  line,
  side,
  ctx,
  expand,
}: {
  line: DiffLine | null;
  side: "old" | "new";
  ctx?: CommentContext;
  expand?: ExpandContext;
}) {
  if (line === null) {
    return (
      <Flex bg="bg.subtle">
        <Text as="span" whiteSpace="pre">
          {" "}
        </Text>
      </Flex>
    );
  }
  if (line.kind === "hunk" || line.kind === "meta") {
    // Both columns get the expand button — left-only was easy to miss.
    const hiddenAbove =
      line.kind === "hunk" ? expand?.hiddenAbove(line) : undefined;
    return (
      <Flex bg="bg.muted" color="fg.muted">
        {expand && hiddenAbove !== undefined && (
          <ExpandButton
            hidden={hiddenAbove}
            onExpand={() => expand.expand(line)}
          />
        )}
        <Text as="span" px="3" py="0.5" whiteSpace="pre">
          {side === "old" ? line.text || " " : " "}
        </Text>
      </Flex>
    );
  }
  const style = rowStyles[line.kind];
  const anchor = ctx?.anchorOf(line);
  // A context line renders in both columns but anchors RIGHT — offer its
  // "+" only in the new column so each button maps to one side.
  const plusHere =
    anchor !== undefined &&
    (side === "old" ? line.kind === "del" : line.kind !== "del");
  const selected = ctx?.isSelected(line) ?? false;
  const commented = ctx?.isCommented(line) ?? false;
  return (
    <Flex
      className={plusHere ? "group" : undefined}
      position="relative"
      bg={selected ? "blue.subtle" : style.bg}
      boxShadow={commented ? commentedStripe : undefined}
      onMouseEnter={anchor ? () => ctx?.extendSelect(line) : undefined}
    >
      <Gutter value={side === "old" ? line.oldNumber : line.newNumber} />
      <Sign value={style.sign} />
      <CodeText html={line.html} />
      {plusHere && ctx && <PlusButton anchor={anchor} ctx={ctx} />}
    </Flex>
  );
}

interface SplitSegment {
  rows: SplitRow[];
  threads: ReviewThread[];
  drafts: DraftReviewComment[];
  explanations: ResolvedExplanation[];
  composer: boolean;
}

function SplitRows({
  lines,
  ctx,
  expand,
  background,
}: {
  lines: DiffLine[];
  ctx?: CommentContext;
  expand?: ExpandContext;
  background: ReturnType<typeof syntaxBackground>;
}) {
  const rows = useMemo(() => buildSplitRows(lines), [lines]);

  // A comment band must span the full pane width, but the two sides are
  // independent scroll columns — so the row list is cut into column-pair
  // segments with the bands rendered between them.
  const segments: SplitSegment[] = [];
  let current: SplitRow[] = [];
  for (const row of rows) {
    current.push(row);
    if (!ctx) continue;
    const cells = row.left === row.right ? [row.left] : [row.left, row.right];
    const threads = cells.flatMap((cell) => (cell ? ctx.threadsFor(cell) : []));
    const drafts = cells.flatMap((cell) => (cell ? ctx.draftsFor(cell) : []));
    const explanations = cells.flatMap((cell) =>
      cell ? ctx.explanationsFor(cell) : [],
    );
    const composer = cells.some(
      (cell) => cell !== null && ctx.isComposerLine(cell),
    );
    if (
      threads.length > 0 ||
      drafts.length > 0 ||
      explanations.length > 0 ||
      composer
    ) {
      segments.push({ rows: current, threads, drafts, explanations, composer });
      current = [];
    }
  }
  if (current.length > 0 || segments.length === 0) {
    segments.push({
      rows: current,
      threads: [],
      drafts: [],
      explanations: [],
      composer: false,
    });
  }

  return (
    <Box>
      {segments.map((segment, segmentIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: segments have no stable id
        <Fragment key={segmentIndex}>
          <Flex alignItems="stretch">
            {(["old", "new"] as const).map((side) => (
              <Box
                key={side}
                flex="1"
                minW="0"
                overflowX="auto"
                borderLeftWidth={side === "new" ? "1px" : undefined}
                css={scrollbar}
              >
                <Box minW="max-content" css={background}>
                  {segment.rows.map((row, index) => (
                    <SplitCell
                      // biome-ignore lint/suspicious/noArrayIndexKey: patch rows have no stable id
                      key={index}
                      line={side === "old" ? row.left : row.right}
                      side={side}
                      ctx={ctx}
                      expand={expand}
                    />
                  ))}
                </Box>
              </Box>
            ))}
          </Flex>
          {ctx && (
            <CommentBands
              ctx={ctx}
              threads={segment.threads}
              drafts={segment.drafts}
              explanations={segment.explanations}
              composerHere={segment.composer}
            />
          )}
        </Fragment>
      ))}
      {expand && expand.tailHidden !== undefined && (
        <TailExpandRow expand={expand} />
      )}
    </Box>
  );
}

// Renders a file's patch as diff rows — unified or side-by-side, following
// the global view mode. Sizing and scrolling are the parent's job, so this
// can live in a full pane (DiffView) or an embedded card. Memoized because
// the row tree is by far the most expensive thing on screen — parents
// re-render freely (e.g. on every file-filter keystroke) and must not drag
// thousands of diff rows along.
function DiffLines({ file, commenting, expansion }: Props) {
  const mode = useDiffViewMode();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [wide, setWide] = useState(false);
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [composing, setComposing] = useState(false);
  const [expandedGaps, setExpandedGaps] = useState<ReadonlySet<number>>(
    new Set(),
  );

  useEffect(() => {
    if (mode !== "dynamic") return;
    // Measure the scroll container this diff lives in, not the diff itself
    // (which can be wider than the viewport).
    const container = rootRef.current?.parentElement;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      setWide(container.clientWidth >= SPLIT_MIN_WIDTH);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [mode]);

  // This component instance is reused when the user switches files — any
  // in-progress selection belongs to the previous diff.
  // biome-ignore lint/correctness/useExhaustiveDependencies: file.path is the reset trigger
  useEffect(() => {
    setSelection(null);
    setComposing(false);
    setExpandedGaps(new Set());
  }, [file.path]);

  // Releasing the mouse anywhere finishes the selection and opens the
  // composer under its last line.
  useEffect(() => {
    if (!selection || composing) return;
    function finish() {
      setComposing(true);
    }
    window.addEventListener("mouseup", finish);
    return () => window.removeEventListener("mouseup", finish);
  }, [selection, composing]);

  const split = mode === "split" || (mode === "dynamic" && wide);
  const language = languageForPath(file.path);
  // Changing the theme changes the html of every line, so it belongs in the
  // dependencies of both highlighting memos below.
  const themes = useSyntaxThemes();
  const lines = useMemo(
    () => (file.patch ? parsePatch(file.patch, language, themes) : []),
    [file.patch, language, themes],
  );

  const fullFile = expansion?.fullFile ?? null;
  const fileLines = useMemo(() => {
    if (fullFile === null) return null;
    const parts = fullFile.split("\n");
    if (parts.at(-1) === "") parts.pop();
    return parts;
  }, [fullFile]);
  const fileHtml = useMemo(
    () =>
      fullFile !== null && language
        ? highlightToLines(fullFile, language, themes)
        : null,
    [fullFile, language, themes],
  );

  // Guard against the fetched file not matching the diff (stale clone, wrong
  // sha): if any added/context line disagrees with it, ignore the file.
  const fileMatchesDiff = useMemo(() => {
    if (!fileLines) return false;
    return lines.every(
      (line) =>
        (line.kind !== "add" && line.kind !== "context") ||
        line.newNumber === null ||
        fileLines[line.newNumber - 1] === line.text,
    );
  }, [fileLines, lines]);
  const fileReady = fileLines !== null && fileMatchesDiff;

  // What actually renders: hunk lines get their html swapped for slices of
  // the whole highlighted file (fragment highlighting mis-colors hunks that
  // start mid-construct, e.g. inside a JSX tag), and expanded gaps are
  // spliced in as extra context rows.
  const displayLines = useMemo(() => {
    if (!fileReady || !fileLines) return lines;
    let result = lines;
    if (fileHtml) {
      result = result.map((line) =>
        (line.kind === "add" || line.kind === "context") &&
        line.newNumber !== null &&
        fileHtml[line.newNumber - 1] !== undefined
          ? { ...line, html: fileHtml[line.newNumber - 1] }
          : line,
      );
    }
    return expandedGaps.size > 0
      ? expandLines(result, expandedGaps, fileLines, fileHtml)
      : result;
  }, [lines, fileReady, fileLines, fileHtml, expandedGaps]);

  const anchors = useMemo(() => {
    const map = new Map<DiffLine, CommentAnchor>();
    let hunk = -1;
    // Expanded runs separate hunks exactly like the headers they replaced —
    // a comment selection still can't cross what GitHub sees as a boundary.
    let inSeparator = false;
    for (const line of displayLines) {
      if (line.kind === "hunk" || line.expanded) {
        if (!inSeparator) {
          hunk++;
          inSeparator = true;
        }
        continue;
      }
      inSeparator = false;
      if (line.kind === "del" && line.oldNumber !== null) {
        map.set(line, { side: "LEFT", line: line.oldNumber, hunk });
      } else if (
        (line.kind === "add" || line.kind === "context") &&
        line.newNumber !== null
      ) {
        map.set(line, { side: "RIGHT", line: line.newNumber, hunk });
      }
    }
    return map;
  }, [displayLines]);

  const threadsByKey = useMemo(() => {
    const map = new Map<string, ReviewThread[]>();
    for (const thread of commenting?.threads ?? []) {
      const { side, line } = thread.root;
      if (line === null) continue;
      const key = `${side}:${line}`;
      const list = map.get(key);
      if (list) list.push(thread);
      else map.set(key, [thread]);
    }
    return map;
  }, [commenting?.threads]);

  const draftsByKey = useMemo(() => {
    const map = new Map<string, DraftReviewComment[]>();
    for (const draft of commenting?.drafts ?? []) {
      const key = `${draft.side}:${draft.line}`;
      const list = map.get(key);
      if (list) list.push(draft);
      else map.set(key, [draft]);
    }
    return map;
  }, [commenting?.drafts]);

  // Every line an explanation could anchor to, with its current text — the
  // input to re-validating anchors written against an earlier commit.
  const anchoredLines = useMemo(() => {
    const result: AnchoredLine[] = [];
    for (const line of displayLines) {
      const anchor = anchors.get(line);
      if (anchor) {
        result.push({ side: anchor.side, line: anchor.line, text: line.text });
      }
    }
    return result;
  }, [displayLines, anchors]);

  // Explanations carry the commit they were written against, so each one is
  // re-anchored against the diff on screen: unchanged code that merely moved
  // snaps to its new line, genuinely changed code gets flagged stale.
  const explanationsByKey = useMemo(() => {
    const map = new Map<string, ResolvedExplanation[]>();
    for (const explanation of commenting?.explanations ?? []) {
      const resolved = resolveExplanation(
        explanation,
        commenting?.commitId ?? "",
        anchoredLines,
      );
      const key = `${explanation.side}:${resolved.line}`;
      const list = map.get(key);
      if (list) list.push(resolved);
      else map.set(key, [resolved]);
    }
    return map;
  }, [commenting?.explanations, commenting?.commitId, anchoredLines]);

  // Every side:line an existing thread's or draft's range covers, so those
  // lines can be marked in the gutter.
  const commentedKeys = useMemo(() => {
    const keys = new Set<string>();
    function mark(side: DiffSide, line: number | null, start: number | null) {
      if (line === null) return;
      for (let n = start ?? line; n <= line; n++) {
        keys.add(`${side}:${n}`);
      }
    }
    for (const thread of commenting?.threads ?? []) {
      mark(thread.root.side, thread.root.line, thread.root.startLine);
    }
    for (const draft of commenting?.drafts ?? []) {
      mark(draft.side, draft.line, draft.startLine);
    }
    return keys;
  }, [commenting?.threads, commenting?.drafts]);

  // Gap ids are hunk-line indices in the ORIGINAL parsed lines; the hunk
  // DiffLine objects survive into displayLines untouched, so renderers can
  // look their gap up by identity even after splicing shifts positions.
  const gapIdByLine = useMemo(() => {
    const map = new Map<DiffLine, number>();
    lines.forEach((line, index) => {
      if (line.kind === "hunk") map.set(line, index);
    });
    return map;
  }, [lines]);
  const gaps = useMemo(
    () => (expansion ? computeGaps(lines, fileLines?.length ?? null) : null),
    [expansion, lines, fileLines],
  );

  let expandCtx: ExpandContext | undefined;
  if (expansion && gaps) {
    const tail = gaps.get(TAIL_GAP);
    expandCtx = {
      hiddenAbove: (line) => {
        const id = gapIdByLine.get(line);
        const hidden = id === undefined ? undefined : gaps.get(id);
        return hidden === 0 || hidden == null ? undefined : hidden;
      },
      expand: (line) => {
        const id = gapIdByLine.get(line);
        if (id === undefined) return;
        expansion.requestFullFile();
        setExpandedGaps((prev) => new Set(prev).add(id));
      },
      tailHidden:
        tail === undefined ||
        tail === 0 ||
        (expandedGaps.has(TAIL_GAP) && fileReady)
          ? undefined
          : tail,
      expandTail: () => {
        expansion.requestFullFile();
        setExpandedGaps((prev) => new Set(prev).add(TAIL_GAP));
      },
    };
  }

  let ctx: CommentContext | undefined;
  if (commenting) {
    const low = selection ? Math.min(selection.start, selection.end) : 0;
    const high = selection ? Math.max(selection.start, selection.end) : 0;
    // The text of the currently selected lines, in diff order — quoted to the
    // agent by the composer's "Explain" action.
    const selectedCode = (): string => {
      if (!selection) return "";
      const texts: string[] = [];
      for (const line of displayLines) {
        const anchor = anchors.get(line);
        if (
          anchor &&
          anchor.side === selection.side &&
          anchor.line >= low &&
          anchor.line <= high
        ) {
          texts.push(line.text);
        }
      }
      return texts.join("\n");
    };
    ctx = {
      repo: commenting.repo,
      prNumber: commenting.prNumber,
      commitId: commenting.commitId,
      path: file.path,
      resolvedIds: commenting.resolvedRootIds,
      reviewStarted: commenting.reviewStarted,
      composer:
        selection && composing
          ? {
              side: selection.side,
              line: high,
              startLine: low < high ? low : null,
              code: selectedCode(),
            }
          : null,
      anchorOf: (line) => anchors.get(line),
      threadsFor: (line) => {
        const result: ReviewThread[] = [];
        if (line.oldNumber !== null) {
          result.push(...(threadsByKey.get(`LEFT:${line.oldNumber}`) ?? []));
        }
        if (line.newNumber !== null) {
          result.push(...(threadsByKey.get(`RIGHT:${line.newNumber}`) ?? []));
        }
        return result;
      },
      draftsFor: (line) => {
        const result: DraftReviewComment[] = [];
        if (line.oldNumber !== null) {
          result.push(...(draftsByKey.get(`LEFT:${line.oldNumber}`) ?? []));
        }
        if (line.newNumber !== null) {
          result.push(...(draftsByKey.get(`RIGHT:${line.newNumber}`) ?? []));
        }
        return result;
      },
      explanationsFor: (line) => {
        const result: ResolvedExplanation[] = [];
        if (line.oldNumber !== null) {
          result.push(
            ...(explanationsByKey.get(`LEFT:${line.oldNumber}`) ?? []),
          );
        }
        if (line.newNumber !== null) {
          result.push(
            ...(explanationsByKey.get(`RIGHT:${line.newNumber}`) ?? []),
          );
        }
        return result;
      },
      isCommented: (line) =>
        (line.oldNumber !== null &&
          commentedKeys.has(`LEFT:${line.oldNumber}`)) ||
        (line.newNumber !== null &&
          commentedKeys.has(`RIGHT:${line.newNumber}`)),
      isSelected: (line) => {
        if (!selection) return false;
        const anchor = anchors.get(line);
        return (
          anchor !== undefined &&
          anchor.side === selection.side &&
          anchor.line >= low &&
          anchor.line <= high
        );
      },
      isComposerLine: (line) => {
        if (!selection || !composing) return false;
        const anchor = anchors.get(line);
        return (
          anchor !== undefined &&
          anchor.side === selection.side &&
          anchor.line === high
        );
      },
      startSelect: (event, anchor) => {
        // Keep the browser from starting a text selection under the drag.
        event.preventDefault();
        // An open composer keeps its text until it's cancelled explicitly.
        if (composing) return;
        setSelection({
          side: anchor.side,
          start: anchor.line,
          end: anchor.line,
          hunk: anchor.hunk,
        });
      },
      extendSelect: (line) => {
        if (!selection || composing) return;
        const anchor = anchors.get(line);
        if (
          !anchor ||
          anchor.side !== selection.side ||
          anchor.hunk !== selection.hunk
        ) {
          return;
        }
        if (anchor.line !== selection.end) {
          setSelection({ ...selection, end: anchor.line });
        }
      },
      closeComposer: () => {
        setSelection(null);
        setComposing(false);
      },
    };
  }

  const background = syntaxBackground(themes);
  return (
    <Box ref={rootRef} {...diffFontStyles} css={tokenColors}>
      {split ? (
        <SplitRows
          lines={displayLines}
          ctx={ctx}
          expand={expandCtx}
          background={background}
        />
      ) : (
        <InlineRows
          lines={displayLines}
          ctx={ctx}
          expand={expandCtx}
          background={background}
        />
      )}
    </Box>
  );
}

export default memo(DiffLines);
