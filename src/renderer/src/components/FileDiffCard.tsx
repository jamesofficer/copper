import { Box, HStack, Text } from "@chakra-ui/react";
import { useState } from "react";
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

// A file's diff in a collapsible bordered card, for embedding inside the
// Review tab's change groups.
export default function FileDiffCard({ file, defaultOpen = true, id }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = statusMeta[file.status];

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
          <Box
            maxH="360px"
            overflow="auto"
            borderTopWidth="1px"
            css={scrollbar}
          >
            <DiffLines file={file} />
          </Box>
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
