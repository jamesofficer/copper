import { Box, HStack, Icon, IconButton, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuCheck } from "react-icons/lu";
import type { PullRequestFile } from "../../../shared/types";
import { useFilePathDisplay } from "../lib/filePathDisplay";
import { statusMeta } from "../lib/fileStatus";
import CommentCountBadge from "./CommentCountBadge";
import ExplanationCountBadge from "./ExplanationCountBadge";

interface Props {
  files: PullRequestFile[];
  selectedPath: string | null;
  onSelect(path: string): void;
  // Undefined hides viewed indicators (commit-by-commit views — viewed state
  // is scoped to the full PR changelist).
  viewedPaths?: Set<string>;
  // Review comments per file path; undefined hides the chips.
  commentCounts?: Map<string, number>;
  // Local AI explanations per file path; undefined hides the chips.
  explanationCounts?: Map<string, number>;
  // A per-row button revealed on hover — stage/unstage in the Current changes
  // view. Undefined leaves the rows action-free, as the PR views want them.
  rowAction?: {
    icon: ReactNode;
    label: string;
    onRun(path: string): void;
  };
}

export default function FileList({
  files,
  selectedPath,
  onSelect,
  viewedPaths,
  commentCounts,
  explanationCounts,
  rowAction,
}: Props) {
  const display = useFilePathDisplay();

  return (
    <Stack gap="0.5">
      {files.map((file) => {
        const meta = statusMeta[file.status];
        const selected = file.path === selectedPath;
        const viewed = viewedPaths?.has(file.path) ?? false;
        const comments = commentCounts?.get(file.path) ?? 0;
        const explanations = explanationCounts?.get(file.path) ?? 0;
        const slash = file.path.lastIndexOf("/");
        const dir = slash === -1 ? "" : file.path.slice(0, slash + 1);
        const name = slash === -1 ? file.path : file.path.slice(slash + 1);
        return (
          // The action sits over the diff counts rather than beside the row:
          // a button hanging off the edge shrinks the row and reads as though
          // it belongs to the list, not the file.
          <Box key={file.path} className="group" position="relative">
            <Box
              as="button"
              display="block"
              w="full"
              minW="0"
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
                <Box flex="1" minW="0" title={file.path}>
                  <Text as="span" fontSize="xs" display="block" truncate>
                    {display === "inline" && (
                      <Text as="span" color="fg.muted">
                        {dir}
                      </Text>
                    )}
                    {name}
                  </Text>
                  {display === "stacked" && dir !== "" && (
                    <Text
                      as="span"
                      display="block"
                      fontSize="2xs"
                      color="fg.muted"
                      truncate
                    >
                      {dir.slice(0, -1)}
                    </Text>
                  )}
                </Box>
                <HStack
                  gap="1.5"
                  fontFamily="mono"
                  fontSize="2xs"
                  flexShrink="0"
                  _groupHover={rowAction ? { opacity: 0 } : undefined}
                >
                  <CommentCountBadge count={comments} />
                  <ExplanationCountBadge count={explanations} />
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
            {rowAction && (
              <IconButton
                position="absolute"
                right="1"
                top="50%"
                transform="translateY(-50%)"
                size="2xs"
                variant="ghost"
                aria-label={`${rowAction.label} ${file.path}`}
                title={rowAction.label}
                opacity="0"
                _groupHover={{ opacity: 1 }}
                _focusVisible={{ opacity: 1 }}
                onClick={() => rowAction.onRun(file.path)}
              >
                {rowAction.icon}
              </IconButton>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
