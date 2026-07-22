import { Box, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { LuCheck } from "react-icons/lu";
import type { PullRequestFile } from "../../../shared/types";
import { statusMeta } from "../lib/fileStatus";

interface Props {
  files: PullRequestFile[];
  selectedPath: string | null;
  onSelect(path: string): void;
  // Undefined hides viewed indicators (commit-by-commit views — viewed state
  // is scoped to the full PR changelist).
  viewedPaths?: Set<string>;
}

export default function FileList({
  files,
  selectedPath,
  onSelect,
  viewedPaths,
}: Props) {
  return (
    <Stack gap="0.5">
      {files.map((file) => {
        const meta = statusMeta[file.status];
        const selected = file.path === selectedPath;
        const viewed = viewedPaths?.has(file.path) ?? false;
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
            opacity={viewed ? 0.55 : undefined}
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
                {viewed && (
                  <Icon color="green.fg" size="xs">
                    <LuCheck />
                  </Icon>
                )}
              </HStack>
            </HStack>
          </Box>
        );
      })}
    </Stack>
  );
}
