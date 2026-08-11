import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface Props {
  // Tinted by state where the row has one — see PullRequestQueueRow.
  icon: ReactNode;
  title: string;
  // Sits at the right of the title line: the diff counts on a pull request.
  trailing?: ReactNode;
  // Second line: number, author, and the row's own counts.
  meta: ReactNode;
  // Third line, when there is one. Left truncates, right stays whole.
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  selected?: boolean;
  onClick(): void;
  onDoubleClick?(): void;
}

// One row of the review queue. Rows, not cards: the queue is a narrow column
// read top to bottom, so the list is separated by hairlines and the selected
// row is marked with an accent bar down its left edge.
export default function QueueRow({
  icon,
  title,
  trailing,
  meta,
  footerLeft,
  footerRight,
  selected,
  onClick,
  onDoubleClick,
}: Props) {
  return (
    <Box
      as="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      display="block"
      w="full"
      minW="0"
      textAlign="left"
      position="relative"
      px="4"
      py="3.5"
      borderBottomWidth="1px"
      cursor="pointer"
      transition="background 0.12s"
      bg={selected ? "bg.subtle" : undefined}
      _hover={{ bg: "bg.subtle" }}
    >
      {selected && (
        <Box
          position="absolute"
          left="0"
          top="0"
          bottom="0"
          w="3px"
          bg="colorPalette.solid"
        />
      )}
      <HStack gap="2.5" alignItems="flex-start" minW="0">
        <Box flexShrink="0" mt="0.5">
          {icon}
        </Box>
        <Stack gap="1.5" flex="1" minW="0">
          <HStack gap="2" alignItems="baseline" minW="0">
            <Text fontWeight="medium" fontSize="sm" flex="1" minW="0" truncate>
              {title}
            </Text>
            {trailing && <Box flexShrink="0">{trailing}</Box>}
          </HStack>
          <HStack
            fontFamily="mono"
            fontSize="xs"
            color="fg.muted"
            gap="2"
            minW="0"
          >
            {meta}
          </HStack>
          {(footerLeft || footerRight) && (
            <HStack
              fontFamily="mono"
              fontSize="xs"
              color="fg.subtle"
              gap="2"
              minW="0"
            >
              <Box flex="1" minW="0" truncate>
                {footerLeft}
              </Box>
              {footerRight}
            </HStack>
          )}
        </Stack>
      </HStack>
    </Box>
  );
}
