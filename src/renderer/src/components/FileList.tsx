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
  // Adds the Changes view's narrow selected-file marker without changing the
  // Current changes list, which uses selection only to choose a diff.
  selectedIndicator?: boolean;
  // Per-row buttons revealed on hover, in place of the diff counts —
  // stage/discard in the Current changes view. Undefined leaves the rows
  // action-free, as the PR views want them.
  rowActions?: RowAction[];
  // Tints the file name — the staged group uses it so a row carries its own
  // state, rather than that state living only in the heading above it.
  nameColor?: string;
}

export interface RowAction {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onRun(path: string): void;
}

// The counts and the actions occupy the same slot, so one condition drives
// both — same selectors, inverse values, so they can never draw at once.
//
// :focus-visible, not :focus-within: closing the discard dialog hands focus
// back to the button that opened it, and :focus-within can't tell that from a
// deliberate tab, so the row stayed stuck showing its buttons. The browser
// only marks programmatically restored focus as visible when the user was
// already navigating by keyboard — which is exactly when the row should keep
// showing them.
const revealed = ".group:hover &, .group:has(:focus-visible) &";

export default function FileList({
  files,
  selectedPath,
  onSelect,
  viewedPaths,
  commentCounts,
  explanationCounts,
  selectedIndicator,
  rowActions,
  nameColor,
}: Props) {
  const display = useFilePathDisplay();

  return (
    <Stack gap="1">
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
              rounded="lg"
              overflow="hidden"
              position="relative"
              px="3"
              py="2"
              bg={selected ? "bg.emphasized" : "transparent"}
              _hover={{ bg: selected ? "bg.emphasized" : "bg.subtle" }}
              opacity={viewed ? 0.55 : undefined}
              _before={
                selected && selectedIndicator
                  ? {
                      content: '""',
                      position: "absolute",
                      insetBlock: "0",
                      insetInlineStart: "0",
                      w: "0.5",
                      bg: "colorPalette.solid",
                      roundedLeft: "lg",
                    }
                  : undefined
              }
            >
              <HStack gap="3" minW="0">
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
                  <Text
                    as="span"
                    fontSize="xs"
                    display="block"
                    color={nameColor}
                    truncate
                  >
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
                      mt="0.5"
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
                  css={rowActions ? { [revealed]: { opacity: 0 } } : undefined}
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
            {rowActions && rowActions.length > 0 && (
              <HStack
                position="absolute"
                right="1.5"
                top="50%"
                transform="translateY(-50%)"
                gap="1"
                opacity="0"
                css={{ [revealed]: { opacity: 1 } }}
              >
                {rowActions.map((action) => (
                  <IconButton
                    key={action.label}
                    size="2xs"
                    variant="outline"
                    // A selected row is bg.emphasized, which resolves to the
                    // very same gray as the outline variant's default border
                    // — the button vanished into it. border.emphasized is the
                    // next step out in both modes.
                    borderColor={selected ? "border.emphasized" : undefined}
                    aria-label={`${action.label} ${file.path}`}
                    title={action.label}
                    disabled={action.disabled}
                    onClick={() => action.onRun(file.path)}
                  >
                    {action.icon}
                  </IconButton>
                ))}
              </HStack>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
