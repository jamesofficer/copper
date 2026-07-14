import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import type { FileStatus, PullRequestFile } from "../../../shared/types";

interface Props {
  files: PullRequestFile[];
  selectedPath: string | null;
  onSelect(path: string): void;
}

const statusMeta: Record<FileStatus, { label: string; color: string }> = {
  added: { label: "A", color: "green.fg" },
  modified: { label: "M", color: "yellow.fg" },
  deleted: { label: "D", color: "red.fg" },
  renamed: { label: "R", color: "purple.fg" },
};

export default function FileList({ files, selectedPath, onSelect }: Props) {
  return (
    <Stack gap="0.5">
      {files.map((file) => {
        const meta = statusMeta[file.status];
        const selected = file.path === selectedPath;
        const slash = file.path.lastIndexOf("/");
        const dir = slash === -1 ? "" : file.path.slice(0, slash + 1);
        const name = slash === -1 ? file.path : file.path.slice(slash + 1);
        return (
          <Box
            key={file.path}
            as="button"
            onClick={() => onSelect(file.path)}
            textAlign="left"
            rounded="md"
            px="2"
            py="1.5"
            bg={selected ? "bg.emphasized" : "transparent"}
            _hover={{ bg: selected ? "bg.emphasized" : "bg.subtle" }}
          >
            <HStack gap="2" minW="0">
              <Text
                as="span"
                fontFamily="mono"
                fontSize="xs"
                fontWeight="bold"
                color={meta.color}
                w="3"
                flexShrink="0"
              >
                {meta.label}
              </Text>
              <Text as="span" fontSize="xs" flex="1" truncate title={file.path}>
                <Text as="span" color="fg.muted">
                  {dir}
                </Text>
                {name}
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
          </Box>
        );
      })}
    </Stack>
  );
}
