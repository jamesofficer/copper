import {
  Box,
  HStack,
  IconButton,
  Input,
  InputGroup,
  Stack,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { LuSearch, LuSlidersHorizontal } from "react-icons/lu";
import {
  assigneeOptions,
  authorOptions,
  type Listable,
  type ListSort,
  type QueueFilters,
  queueFiltersActive,
  sortOptions,
} from "../lib/listFilters";
import FilterSelect from "./FilterSelect";

interface Props {
  placeholder: string;
  filters: QueueFilters;
  onChange(filters: QueueFilters): void;
  // The whole loaded list, for the Author and Assignee options — they're built
  // from the logins that actually appear in it.
  items: Listable[];
}

// The queue's filter row: a text box that's always there, over dropdowns that
// aren't. The column is too narrow for three selects side by side, and the text
// box is what a reviewer reaches for nine times in ten. Both lists want the same
// three dropdowns, so this owns them rather than take them as children.
export default function QueueFilterBar({
  placeholder,
  filters,
  onChange,
  items,
}: Props) {
  const [open, setOpen] = useState(false);

  // Memoized because the bar re-renders on every keystroke in the text box, and
  // FilterSelect builds its collection from the identity of these arrays.
  const authorItems = useMemo(() => authorOptions(items), [items]);
  const assigneeItems = useMemo(() => assigneeOptions(items), [items]);
  const label = open ? "Hide filters" : "Show filters";

  return (
    <Stack gap="2" px="4" py="3" flexShrink="0">
      <HStack gap="2">
        <InputGroup startElement={<LuSearch size={12} />}>
          <Input
            size="sm"
            placeholder={placeholder}
            value={filters.text}
            onChange={(event) =>
              onChange({ ...filters, text: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === "Escape") onChange({ ...filters, text: "" });
            }}
          />
        </InputGroup>
        <Box position="relative" flexShrink="0">
          <IconButton
            aria-label={label}
            title={label}
            aria-expanded={open}
            size="sm"
            variant="outline"
            onClick={() => setOpen((shown) => !shown)}
          >
            <LuSlidersHorizontal />
          </IconButton>
          {/* A set filter can't hide rows while the control that set it is out
              of sight. */}
          {queueFiltersActive(filters) && (
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
        <Stack gap="2">
          <FilterSelect
            label="Author"
            items={authorItems}
            value={filters.author}
            width="full"
            onChange={(author) => onChange({ ...filters, author })}
          />
          <FilterSelect
            label="Assignee"
            items={assigneeItems}
            value={filters.assignee}
            width="full"
            onChange={(assignee) => onChange({ ...filters, assignee })}
          />
          <FilterSelect
            label="Sort"
            items={sortOptions}
            value={filters.sort}
            width="full"
            onChange={(sort) =>
              onChange({ ...filters, sort: sort as ListSort })
            }
          />
        </Stack>
      )}
    </Stack>
  );
}
