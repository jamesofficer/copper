import {
  Box,
  Checkbox,
  HStack,
  IconButton,
  Input,
  InputGroup,
  Popover,
  Portal,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { LuSearch, LuSettings2 } from "react-icons/lu";
import type { PullRequestDetail } from "../../../../shared/types";
import type { PullRequestPeopleKind } from "../../lib/peopleSelection";
import { usePullRequestPeople } from "../../lib/usePullRequestPeople";
import UserAvatar from "../UserAvatar";

interface Props {
  detail: PullRequestDetail;
  kind: PullRequestPeopleKind;
}

const labels = {
  reviewers: {
    action: "Edit reviewers",
    loading: "Loading reviewers…",
    error: "Couldn’t load reviewers.",
    empty: "No reviewers match.",
  },
  assignees: {
    action: "Edit assignees",
    loading: "Loading assignees…",
    error: "Couldn’t load assignees.",
    empty: "No assignees match.",
  },
} as const;

// A compact multi-select for one people field in the PR rail. It loads
// candidates only after the user opens it.
export default function PeoplePicker({ detail, kind }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const state = usePullRequestPeople({ detail, kind, open });
  const copy = labels[kind];
  const selected = useMemo(() => new Set(state.selected), [state.selected]);
  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return query
      ? state.options.filter((login) => login.toLowerCase().includes(query))
      : state.options;
  }, [filter, state.options]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(event) => {
        setOpen(event.open);
        if (!event.open) setFilter("");
      }}
      positioning={{ placement: "bottom-end" }}
    >
      <Popover.Trigger asChild>
        <IconButton
          aria-label={copy.action}
          title={copy.action}
          variant="ghost"
          size="xs"
          color="fg.muted"
          loading={state.pending}
        >
          <LuSettings2 />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="280px">
            <Popover.Arrow />
            <Popover.Body p="0">
              <Box p="2" borderBottomWidth="1px">
                <InputGroup startElement={<LuSearch size={12} />}>
                  <Input
                    size="xs"
                    placeholder={copy.action}
                    aria-label={`Search ${kind}`}
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  />
                </InputGroup>
              </Box>
              <VStack
                gap="0"
                alignItems="stretch"
                maxH="280px"
                overflowY="auto"
                p="1"
              >
                {state.loading && state.options.length === 0 ? (
                  <HStack px="2" py="2" color="fg.muted">
                    <Spinner size="xs" />
                    <Text fontSize="sm">{copy.loading}</Text>
                  </HStack>
                ) : state.error && state.options.length === 0 ? (
                  <Text px="2" py="2" fontSize="sm" color="fg.error">
                    {copy.error}
                  </Text>
                ) : visible.length === 0 ? (
                  <Text px="2" py="2" fontSize="sm" color="fg.muted">
                    {copy.empty}
                  </Text>
                ) : (
                  visible.map((login) => (
                    <Checkbox.Root
                      key={login}
                      size="sm"
                      checked={selected.has(login)}
                      disabled={state.pending}
                      onCheckedChange={(event) =>
                        state.setSelected(login, Boolean(event.checked))
                      }
                      px="2"
                      py="1.5"
                      borderRadius="sm"
                      cursor="pointer"
                      _hover={{ bg: "bg.muted" }}
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                      <Checkbox.Label minW="0" flex="1">
                        <HStack gap="2" minW="0">
                          <UserAvatar username={login} />
                          <Text fontFamily="mono" fontSize="sm" truncate>
                            {login}
                          </Text>
                        </HStack>
                      </Checkbox.Label>
                    </Checkbox.Root>
                  ))
                )}
              </VStack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
