import { Box, Flex, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PullRequestFile } from "../../../shared/types";
import {
  buildSplitRows,
  type DiffLine,
  type LineKind,
  languageForPath,
  parsePatch,
} from "../lib/diffParser";
import { useDiffViewMode } from "../lib/diffViewMode";
import { scrollbar } from "../lib/scrollbar";
import { tokenColors } from "../lib/syntaxColors";

interface Props {
  file: PullRequestFile;
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

function InlineRows({ lines }: { lines: DiffLine[] }) {
  return (
    // minW=max-content: inside a scroll container a block element only gets
    // the visible width, so short rows' backgrounds would stop there when
    // scrolled right. Sizing this to the widest row lets every row fill it.
    <Box minW="max-content">
      {lines.map((line, index) => {
        const style = rowStyles[line.kind];
        return (
          <Flex
            // biome-ignore lint/suspicious/noArrayIndexKey: patch lines have no stable id
            key={index}
            bg={style.bg}
            color={line.kind === "hunk" ? "fg.muted" : "fg"}
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
          </Flex>
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
}: {
  line: DiffLine | null;
  side: "old" | "new";
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
  return (
    <Flex bg={style.bg}>
      <Gutter value={side === "old" ? line.oldNumber : line.newNumber} />
      <Sign value={style.sign} />
      <CodeText html={line.html} />
    </Flex>
  );
}

function SplitRows({ lines }: { lines: DiffLine[] }) {
  const rows = useMemo(() => buildSplitRows(lines), [lines]);
  return (
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
            {rows.map((row, index) => (
              <SplitCell
                // biome-ignore lint/suspicious/noArrayIndexKey: patch rows have no stable id
                key={index}
                line={side === "old" ? row.left : row.right}
                side={side}
              />
            ))}
          </Box>
        </Box>
      ))}
    </Flex>
  );
}

// Renders a file's patch as diff rows — unified or side-by-side, following
// the global view mode. Sizing and scrolling are the parent's job, so this
// can live in a full pane (DiffView) or an embedded card.
export default function DiffLines({ file }: Props) {
  const mode = useDiffViewMode();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [wide, setWide] = useState(false);

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

  const split = mode === "split" || (mode === "dynamic" && wide);
  const language = languageForPath(file.path);
  const lines = useMemo(
    () => (file.patch ? parsePatch(file.patch, language) : []),
    [file.patch, language],
  );

  return (
    <Box ref={rootRef} {...fontStyles} css={tokenColors}>
      {split ? <SplitRows lines={lines} /> : <InlineRows lines={lines} />}
    </Box>
  );
}
