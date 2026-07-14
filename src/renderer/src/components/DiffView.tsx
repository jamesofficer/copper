import { Box, Center, Text } from "@chakra-ui/react";
import type { PullRequestFile } from "../../../shared/types";
import { scrollbar } from "../lib/scrollbar";
import DiffLines from "./DiffLines";

interface Props {
  file: PullRequestFile;
}

export default function DiffView({ file }: Props) {
  if (!file.patch) {
    return (
      <Center h="full" p="8">
        <Text color="fg.muted" fontSize="sm" textAlign="center">
          {file.status === "renamed"
            ? "File renamed with no content changes."
            : "No text diff available — this file is binary or too large to show."}
        </Text>
      </Center>
    );
  }

  return (
    <Box h="full" overflow="auto" css={scrollbar}>
      <DiffLines file={file} />
    </Box>
  );
}
