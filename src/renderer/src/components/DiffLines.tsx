import { Box, Flex, Text } from "@chakra-ui/react";
import {
  Fragment,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LuPlus } from "react-icons/lu";
import type { DiffSide, PullRequestFile } from "../../../shared/types";
import {
  buildSplitRows,
  type DiffLine,
  type LineKind,
  languageForPath,
  parsePatch,
  type SplitRow,
} from "../lib/diffParser";
import { useDiffViewMode } from "../lib/diffViewMode";
import type { ReviewThread } from "../lib/reviewComments";
import { scrollbar } from "../lib/scrollbar";
import { tokenColors } from "../lib/syntaxColors";
import DiffCommentComposer from "./DiffCommentComposer";
import DiffCommentThread from "./DiffCommentThread";

// Everything a diff needs to host inline review comments: the file's
// existing threads plus the ids the composer posts new ones with.
export interface DiffCommenting {
  repo: string;
  prNumber: number;
  commitId: string;
  threads: ReviewThread[];
}

interface Props {
  file: PullRequestFile;
  // When set, lines grow a hover "+" button for commenting and existing
  // threads render under the lines they anchor to.
  commenting?: DiffCommenting;
}

// "dynamic" mode switches to side-by-side when the diff's container is at
// least this wide.
const SPLIT_MIN_WIDTH = 960;

const rowStyles: Record<LineKind, { bg: string; sign: string }> = {
  add: { bg: "green.subtle", sign: "+" },
  del: { bg: "red.subtle", sign: "-" },
  context: { bg: "transparent", sign: " " },
  hunk: { bg: "bg.muted", sign: "" },
  meta: { bg: "transparent", sign: "" },
};

const fontStyles = {
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

interface DraftRange {
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
  composer: { side: DiffSide; line: number; startLine: number | null } | null;
  anchorOf(line: DiffLine): CommentAnchor | undefined;
  threadsFor(line: DiffLine): ReviewThread[];
  // Whether an existing thread's range covers this line — marks the lines a
  // comment was left on.
  isCommented(line: DiffLine): boolean;
  isSelected(line: DiffLine): boolean;
  isComposerLine(line: DiffLine): boolean;
  startSelect(event: React.MouseEvent, anchor: CommentAnchor): void;
  extendSelect(line: DiffLine): void;
  closeComposer(): void;
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
      // biome-ignore lint/security/noDangerouslySetInnerHtml: highlight.js output is escaped
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
  composerHere,
}: {
  ctx: CommentContext;
  threads: ReviewThread[];
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
}: {
  lines: DiffLine[];
  ctx?: CommentContext;
}) {
  return (
    // minW=max-content: inside a scroll container a block element only gets
    // the visible width, so short rows' backgrounds would stop there when
    // scrolled right. Sizing this to the widest row lets every row fill it.
    <Box minW="max-content">
      {lines.map((line, index) => {
        const style = rowStyles[line.kind];
        const anchor = ctx?.anchorOf(line);
        const selected = ctx?.isSelected(line) ?? false;
        const commented = ctx?.isCommented(line) ?? false;
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
                <Text as="span" px="3" py="0.5" whiteSpace="pre">
                  {line.text}
                </Text>
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
                composerHere={ctx.isComposerLine(line)}
              />
            )}
          </Fragment>
        );
      })}
    </Box>
  );
}

// One side of a split row. Rows across the two columns must stay the same
// height for alignment, so every cell is a single pre-formatted line.
function SplitCell({
  line,
  side,
  ctx,
}: {
  line: DiffLine | null;
  side: "old" | "new";
  ctx?: CommentContext;
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
    return (
      <Flex bg="bg.muted" color="fg.muted">
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
  composer: boolean;
}

function SplitRows({
  lines,
  ctx,
}: {
  lines: DiffLine[];
  ctx?: CommentContext;
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
    const composer = cells.some(
      (cell) => cell !== null && ctx.isComposerLine(cell),
    );
    if (threads.length > 0 || composer) {
      segments.push({ rows: current, threads, composer });
      current = [];
    }
  }
  if (current.length > 0 || segments.length === 0) {
    segments.push({ rows: current, threads: [], composer: false });
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
                <Box minW="max-content">
                  {segment.rows.map((row, index) => (
                    <SplitCell
                      // biome-ignore lint/suspicious/noArrayIndexKey: patch rows have no stable id
                      key={index}
                      line={side === "old" ? row.left : row.right}
                      side={side}
                      ctx={ctx}
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
              composerHere={segment.composer}
            />
          )}
        </Fragment>
      ))}
    </Box>
  );
}

// Renders a file's patch as diff rows — unified or side-by-side, following
// the global view mode. Sizing and scrolling are the parent's job, so this
// can live in a full pane (DiffView) or an embedded card.
export default function DiffLines({ file, commenting }: Props) {
  const mode = useDiffViewMode();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [wide, setWide] = useState(false);
  const [draft, setDraft] = useState<DraftRange | null>(null);
  const [composing, setComposing] = useState(false);

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
    setDraft(null);
    setComposing(false);
  }, [file.path]);

  // Releasing the mouse anywhere finishes the selection and opens the
  // composer under its last line.
  useEffect(() => {
    if (!draft || composing) return;
    function finish() {
      setComposing(true);
    }
    window.addEventListener("mouseup", finish);
    return () => window.removeEventListener("mouseup", finish);
  }, [draft, composing]);

  const split = mode === "split" || (mode === "dynamic" && wide);
  const language = languageForPath(file.path);
  const lines = useMemo(
    () => (file.patch ? parsePatch(file.patch, language) : []),
    [file.patch, language],
  );

  const anchors = useMemo(() => {
    const map = new Map<DiffLine, CommentAnchor>();
    let hunk = -1;
    for (const line of lines) {
      if (line.kind === "hunk") hunk++;
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
  }, [lines]);

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

  // Every side:line an existing thread's range covers, so those lines can be
  // marked in the gutter.
  const commentedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const thread of commenting?.threads ?? []) {
      const { side, line, startLine } = thread.root;
      if (line === null) continue;
      for (let n = startLine ?? line; n <= line; n++) {
        keys.add(`${side}:${n}`);
      }
    }
    return keys;
  }, [commenting?.threads]);

  let ctx: CommentContext | undefined;
  if (commenting) {
    const low = draft ? Math.min(draft.start, draft.end) : 0;
    const high = draft ? Math.max(draft.start, draft.end) : 0;
    ctx = {
      repo: commenting.repo,
      prNumber: commenting.prNumber,
      commitId: commenting.commitId,
      path: file.path,
      composer:
        draft && composing
          ? {
              side: draft.side,
              line: high,
              startLine: low < high ? low : null,
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
      isCommented: (line) =>
        (line.oldNumber !== null &&
          commentedKeys.has(`LEFT:${line.oldNumber}`)) ||
        (line.newNumber !== null &&
          commentedKeys.has(`RIGHT:${line.newNumber}`)),
      isSelected: (line) => {
        if (!draft) return false;
        const anchor = anchors.get(line);
        return (
          anchor !== undefined &&
          anchor.side === draft.side &&
          anchor.line >= low &&
          anchor.line <= high
        );
      },
      isComposerLine: (line) => {
        if (!draft || !composing) return false;
        const anchor = anchors.get(line);
        return (
          anchor !== undefined &&
          anchor.side === draft.side &&
          anchor.line === high
        );
      },
      startSelect: (event, anchor) => {
        // Keep the browser from starting a text selection under the drag.
        event.preventDefault();
        // An open composer keeps its text until it's cancelled explicitly.
        if (composing) return;
        setDraft({
          side: anchor.side,
          start: anchor.line,
          end: anchor.line,
          hunk: anchor.hunk,
        });
      },
      extendSelect: (line) => {
        if (!draft || composing) return;
        const anchor = anchors.get(line);
        if (
          !anchor ||
          anchor.side !== draft.side ||
          anchor.hunk !== draft.hunk
        ) {
          return;
        }
        if (anchor.line !== draft.end) setDraft({ ...draft, end: anchor.line });
      },
      closeComposer: () => {
        setDraft(null);
        setComposing(false);
      },
    };
  }

  return (
    <Box ref={rootRef} {...fontStyles} css={tokenColors}>
      {split ? (
        <SplitRows lines={lines} ctx={ctx} />
      ) : (
        <InlineRows lines={lines} ctx={ctx} />
      )}
    </Box>
  );
}
