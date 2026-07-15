import { Box, Flex, HStack, Text } from "@chakra-ui/react";
import { useRef, useState } from "react";
import { LuChevronRight } from "react-icons/lu";
import type { PullRequestFile } from "../../../shared/types";
import { statusMeta } from "../lib/fileStatus";
import { scrollbar } from "../lib/scrollbar";
import DiffLines from "./DiffLines";

interface Props {
  file: PullRequestFile;
  defaultOpen?: boolean;
  id?: string;
}

const DEFAULT_MAX_HEIGHT = 360;
const MIN_HEIGHT = 120;

// A file's diff in a collapsible bordered card, for embedding inside the
// Review tab's change groups. The body starts capped at DEFAULT_MAX_HEIGHT;
// the grip bar underneath drags it taller (double-click resets).
export default function FileDiffCard({ file, defaultOpen = true, id }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [height, setHeight] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{
    startY: number;
    startHeight: number;
    contentHeight: number;
  } | null>(null);
  const meta = statusMeta[file.status];

  function onResizeStart(event: React.PointerEvent<HTMLDivElement>) {
    const body = bodyRef.current;
    if (!body) return;
    drag.current = {
      startY: event.clientY,
      startHeight: body.offsetHeight,
      contentHeight: body.scrollHeight,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onResizeMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const next = drag.current.startHeight + event.clientY - drag.current.startY;
    // No point dragging past the content itself, or into uselessly small.
    setHeight(Math.min(drag.current.contentHeight, Math.max(MIN_HEIGHT, next)));
  }

  function onResizeEnd(event: React.PointerEvent<HTMLDivElement>) {
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <Box id={id} borderWidth="1px" rounded="md" overflow="hidden">
      <HStack
        as="button"
        onClick={() => setOpen(!open)}
        w="full"
        px="3"
        py="2"
        gap="2"
        bg="bg.subtle"
        _hover={{ bg: "bg.muted" }}
        cursor="pointer"
        textAlign="left"
      >
        <Box
          color="fg.muted"
          transform={open ? "rotate(90deg)" : undefined}
          transition="transform 0.15s"
          flexShrink="0"
        >
          <LuChevronRight size={14} />
        </Box>
        <Text
          as="span"
          fontFamily="mono"
          fontSize="xs"
          fontWeight="bold"
          color={meta.color}
          flexShrink="0"
        >
          {meta.label}
        </Text>
        <Text
          as="span"
          fontFamily="mono"
          fontSize="xs"
          flex="1"
          truncate
          title={file.path}
        >
          {file.path}
        </Text>
        <HStack gap="1.5" fontFamily="mono" fontSize="2xs" flexShrink="0">
          <Text as="span" color="green.fg">
            +{file.additions}
          </Text>
          <Text as="span" color="red.fg">
            −{file.deletions}
          </Text>
        </HStack>
      </HStack>

      {open &&
        (file.patch ? (
          <>
            <Box
              ref={bodyRef}
              maxH={height === null ? `${DEFAULT_MAX_HEIGHT}px` : undefined}
              h={height === null ? undefined : `${height}px`}
              overflow="auto"
              borderTopWidth="1px"
              css={scrollbar}
            >
              <DiffLines file={file} />
            </Box>
            <Flex
              justifyContent="center"
              py="1"
              cursor="row-resize"
              borderTopWidth="1px"
              bg="bg.subtle"
              _hover={{ bg: "bg.muted" }}
              touchAction="none"
              onPointerDown={onResizeStart}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeEnd}
              onDoubleClick={() => setHeight(null)}
              title="Drag to resize · double-click to reset"
            >
              <Box w="8" h="2px" rounded="full" bg="border.emphasized" />
            </Flex>
          </>
        ) : (
          <Text
            fontSize="xs"
            color="fg.muted"
            px="3"
            py="2"
            borderTopWidth="1px"
          >
            {file.status === "renamed"
              ? "File renamed with no content changes."
              : "No text diff available — this file is binary or too large to show."}
          </Text>
        ))}
    </Box>
  );
}
