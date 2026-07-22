import { Box, Center, Flex, HStack, Text } from "@chakra-ui/react";
import type { PullRequestFile } from "../../../shared/types";
import { statusMeta } from "../lib/fileStatus";
import { scrollbar } from "../lib/scrollbar";
import DiffLines, { type DiffCommenting } from "./DiffLines";

interface Props {
  file: PullRequestFile;
  commenting?: DiffCommenting;
}

export default function DiffView({ file, commenting }: Props) {
  const meta = statusMeta[file.status];

  return (
    <Flex direction="column" h="full" minH="0">
      <HStack
        px="4"
        py="2"
        gap="2"
        bg="bg.subtle"
        borderBottomWidth="1px"
        flexShrink="0"
      >
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
        <Text as="span" fontFamily="mono" fontSize="xs" wordBreak="break-all">
          {file.path}
        </Text>
        {file.previousPath && (
          <Text
            as="span"
            fontFamily="mono"
            fontSize="xs"
            color="fg.muted"
            wordBreak="break-all"
          >
            (from {file.previousPath})
          </Text>
        )}
        <HStack
          gap="1.5"
          fontFamily="mono"
          fontSize="2xs"
          flexShrink="0"
          ml="auto"
        >
          <Text as="span" color="green.fg">
            +{file.additions}
          </Text>
          <Text as="span" color="red.fg">
            −{file.deletions}
          </Text>
        </HStack>
      </HStack>

      {file.patch ? (
        <Box flex="1" minH="0" overflow="auto" css={scrollbar}>
          <DiffLines file={file} commenting={commenting} />
        </Box>
      ) : (
        <Center flex="1" p="8">
          <Text color="fg.muted" fontSize="sm" textAlign="center">
            {file.status === "renamed"
              ? "File renamed with no content changes."
              : "No text diff available — this file is binary or too large to show."}
          </Text>
        </Center>
      )}
    </Flex>
  );
}
