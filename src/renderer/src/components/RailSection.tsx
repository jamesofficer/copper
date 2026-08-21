import { Box, HStack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface Props {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

// One titled block in a reading panel's right-hand rail. Its heading is a plain
// sentence-case label, not the uppercase `SectionHeading` the reading column
// uses: the rail is a list of short facts, and the two headings being different
// is what stops the rail reading as a second column of content.
export default function RailSection({ title, action, children }: Props) {
  return (
    <Box>
      <HStack mb="3" minH="6">
        <Text fontSize="sm" fontWeight="semibold" flex="1">
          {title}
        </Text>
        {action}
      </HStack>
      {children}
    </Box>
  );
}
