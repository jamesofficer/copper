import { Box, HStack, Icon, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuGitPullRequest } from "react-icons/lu";
import type { PullRequest } from "../../../shared/types";

interface Props {
  pr: PullRequest;
  meta: ReactNode;
  // Replaces the default PR icon (e.g. the author's avatar).
  leading?: ReactNode;
  // Row-level buttons, revealed over the meta slot while the row is hovered.
  actions?: ReactNode;
  onSelect(pr: PullRequest): void;
}

// One compact PR row in the home sidebar. The clickable part is an inner
// button so hover actions can sit beside it without nesting buttons.
export default function SidebarPullRequestRow({
  pr,
  meta,
  leading,
  actions,
  onSelect,
}: Props) {
  return (
    <HStack
      className="group"
      gap="0"
      rounded="md"
      _hover={{ bg: "bg.subtle" }}
      title={`${pr.repo}#${pr.number} — ${pr.title}`}
    >
      <HStack
        as="button"
        flex="1"
        minW="0"
        gap="2"
        px="2"
        py="1.5"
        cursor="pointer"
        onClick={() => onSelect(pr)}
      >
        {leading ?? (
          <Icon size="sm" color="fg.muted" flexShrink="0">
            <LuGitPullRequest />
          </Icon>
        )}
        <Text fontSize="sm" truncate flex="1" textAlign="left">
          {pr.title}
        </Text>
      </HStack>
      {/* Meta and actions share one grid cell, so the slot is as wide as the
          wider of the two and hovering doesn't shift the row's layout. */}
      <Box display="grid" mr="2" flexShrink="0" fontFamily="mono" fontSize="xs">
        <Box
          gridArea="1 / 1"
          justifySelf="end"
          alignSelf="center"
          _groupHover={actions ? { opacity: 0 } : undefined}
        >
          {meta}
        </Box>
        {actions && (
          <HStack
            gridArea="1 / 1"
            justifySelf="end"
            gap="0"
            opacity="0"
            _groupHover={{ opacity: 1 }}
            _focusWithin={{ opacity: 1 }}
          >
            {actions}
          </HStack>
        )}
      </Box>
    </HStack>
  );
}
