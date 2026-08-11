import { Box, Separator, type SystemStyleObject } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { scrollbar } from "../lib/scrollbar";

// The panel is a column beside the queue on the home screen and the whole
// window on the review screen, so the rail can't key off viewport breakpoints —
// a container query asks the only question that matters: is there room here for
// two columns?
const RAIL_BREAKPOINT = "@container (max-width: 900px)";

const panelCss: SystemStyleObject = { containerType: "inline-size" };

const layoutCss: SystemStyleObject = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 260px",
  gap: "8",
  [RAIL_BREAKPOINT]: { gridTemplateColumns: "minmax(0, 1fr)" },
};

// Sticky, so the standing facts stay put while the conversation scrolls — but
// only while the rail is a column; stacked underneath there is nothing to
// stick to.
const railCss: SystemStyleObject = {
  borderLeftWidth: "1px",
  pl: "6",
  position: "sticky",
  top: "0",
  alignSelf: "start",
  [RAIL_BREAKPOINT]: {
    borderLeftWidth: "0",
    borderTopWidth: "1px",
    pl: "0",
    pt: "6",
    position: "static",
  },
};

interface Props {
  // The title block that spans both columns.
  hero: ReactNode;
  // The standing facts, in the right-hand rail.
  rail: ReactNode;
  // The reading column: description, then conversation.
  children: ReactNode;
}

// The shape both reading panels share — a pull request's overview and an
// issue's. One component rather than two copies of the same grid: the two are
// meant to feel like the same screen with different content, and that only
// survives if the measurements live in one place.
export default function ReadingPanel({ hero, rail, children }: Props) {
  return (
    <Box h="full" overflowY="auto" css={scrollbar}>
      <Box maxW="6xl" mx="auto" px="8" py="8" css={panelCss}>
        {hero}

        <Separator my="6" />

        <Box css={layoutCss}>
          <Box minW="0">{children}</Box>
          <Box css={railCss}>{rail}</Box>
        </Box>
      </Box>
    </Box>
  );
}
