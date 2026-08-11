import { Box } from "@chakra-ui/react";
import type { PointerEvent as ReactPointerEvent } from "react";

interface Props {
  // usePanelWidth's startResize.
  onPointerDown(event: ReactPointerEvent): void;
  // Draws the hairline between the two panels. Off where the panel on the
  // other side already has a border of its own, so the seam isn't 2px wide.
  border?: boolean;
}

// The drag strip between a resizable panel and whatever sits beside it. Pair it
// with usePanelWidth, which owns the width and the pointer maths.
export default function ResizeHandle({ onPointerDown, border }: Props) {
  return (
    <Box
      w="1"
      flexShrink="0"
      cursor="col-resize"
      borderLeftWidth={border ? "1px" : undefined}
      onPointerDown={onPointerDown}
      _hover={{ bg: "border.emphasized" }}
      transition="background 0.15s"
    />
  );
}
