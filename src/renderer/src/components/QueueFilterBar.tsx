import {
  Box,
  HStack,
  IconButton,
  Input,
  InputGroup,
  Stack,
} from "@chakra-ui/react";
import { type ReactNode, useState } from "react";
import { LuSearch, LuSlidersHorizontal } from "react-icons/lu";

interface Props {
  placeholder: string;
  value: string;
  onChange(value: string): void;
  // The Author/Assignee/Sort dropdowns, revealed by the sliders button. Each
  // list composes its own, so this component stays domain-free.
  children: ReactNode;
  // Any dropdown away from its default. Marks the button so a filter can't hide
  // rows while the controls that set it are out of sight.
  filtersActive?: boolean;
}

// The queue's filter row: a text box that's always there, over dropdowns that
// aren't. The column is too narrow for three selects side by side, and the text
// box is what a reviewer reaches for nine times in ten.
export default function QueueFilterBar({
  placeholder,
  value,
  onChange,
  children,
  filtersActive,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Stack gap="2" px="4" py="3" flexShrink="0">
      <HStack gap="2">
        <InputGroup startElement={<LuSearch size={12} />}>
          <Input
            size="sm"
            placeholder={placeholder}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onChange("");
            }}
          />
        </InputGroup>
        <Box position="relative" flexShrink="0">
          <IconButton
            aria-label={open ? "Hide filters" : "Show filters"}
            title={open ? "Hide filters" : "Show filters"}
            aria-expanded={open}
            size="sm"
            variant="outline"
            onClick={() => setOpen((shown) => !shown)}
          >
            <LuSlidersHorizontal />
          </IconButton>
          {filtersActive && (
            <Box
              position="absolute"
              top="-2px"
              right="-2px"
              boxSize="2"
              rounded="full"
              bg="colorPalette.solid"
              borderWidth="2px"
              borderColor="bg"
              pointerEvents="none"
            />
          )}
        </Box>
      </HStack>
      {open && (
        <Box>
          <Stack gap="2">{children}</Stack>
        </Box>
      )}
    </Stack>
  );
}
