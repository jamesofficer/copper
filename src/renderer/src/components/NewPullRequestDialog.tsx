import {
  Alert,
  Box,
  Button,
  Checkbox,
  CloseButton,
  Combobox,
  Dialog,
  Field,
  HStack,
  Input,
  Portal,
  Spinner,
  Text,
  useFilter,
  useListCollection,
  VStack,
} from "@chakra-ui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { memo, useEffect, useMemo, useState } from "react";
import { LuArrowLeft, LuGitPullRequestCreate } from "react-icons/lu";
import type { PullRequest } from "../../../shared/types";
import MarkdownEditor, { type MarkdownEditorMode } from "./MarkdownEditor";
import RelativeTime from "./RelativeTime";
import { toaster } from "./ui/toaster";

interface Props {
  repo: string;
  onCreated(pr: PullRequest): void;
}

export default function NewPullRequestDialog({ repo, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  // null = untouched; these fall back to suggestions computed from the
  // branch info once it loads, so late-arriving data still prefills.
  const [head, setHead] = useState<string | null>(null);
  const [base, setBase] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  // null = untouched, so a late-loading PR template can still prefill it; once
  // the user types, their text (even empty) wins.
  const [body, setBody] = useState<string | null>(null);
  const [draft, setDraft] = useState(false);
  const [mode, setMode] = useState<MarkdownEditorMode>("write");

  // staleTime 0: the usual flow is push from the terminal, then open this
  // dialog — it should always see the branch that was just pushed.
  const infoQuery = useQuery({
    queryKey: ["branchInfo", repo],
    queryFn: () => window.api.getBranchInfo(repo),
    enabled: open,
    staleTime: 0,
  });
  const info = infoQuery.data;

  const suggestedHead =
    info?.localBranch &&
    info.localBranch !== info.defaultBranch &&
    info.branches.includes(info.localBranch)
      ? info.localBranch
      : "";
  const selectedHead = head ?? suggestedHead;
  const selectedBase = base ?? info?.defaultBranch ?? "";
  // Untouched body falls back to the repo's PR template once it loads.
  const bodyValue = body ?? info?.pullRequestTemplate ?? "";

  const unpushedLocalBranch =
    info?.localBranch &&
    info.localBranch !== info.defaultBranch &&
    !info.branches.includes(info.localBranch)
      ? info.localBranch
      : null;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setHead(null);
      setBase(null);
      setTitle("");
      setBody(null);
      setDraft(false);
      setMode("write");
    }
  }

  const create = useMutation({
    mutationFn: () =>
      window.api.createPullRequest(repo, {
        title: title.trim(),
        body: bodyValue,
        head: selectedHead,
        base: selectedBase,
        draft,
      }),
    onSuccess: (pr) => {
      toaster.create({
        type: "success",
        title: "Pull request created",
        description: `${pr.repo}#${pr.number} was opened.`,
      });
      handleOpenChange(false);
      onCreated(pr);
    },
    onError: (cause) => {
      toaster.create({
        type: "error",
        title: "Couldn’t create pull request",
        description:
          cause instanceof Error
            ? cause.message.replace(/^.*Error: /, "")
            : String(cause),
        closable: true,
      });
    },
  });

  const canCreate =
    Boolean(selectedHead) &&
    Boolean(selectedBase) &&
    selectedHead !== selectedBase &&
    title.trim().length > 0 &&
    !create.isPending;

  // Stable references so the memoized pickers skip re-rendering while the
  // user types in the title/description — the branch lists can be huge.
  // getBranchInfo returns them newest-commit-first; that order is preserved
  // here and each branch's date is shown in the list.
  const allBranches = useMemo<BranchItem[]>(
    () =>
      info
        ? info.branches.map((branch) => ({
            label: branch,
            value: branch,
            date: info.branchDates?.[branch],
          }))
        : [],
    [info],
  );
  const headBranches = useMemo(
    () => allBranches.filter((item) => item.value !== selectedBase),
    [allBranches, selectedBase],
  );
  const baseBranches = useMemo(
    () => allBranches.filter((item) => item.value !== selectedHead),
    [allBranches, selectedHead],
  );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(event) => handleOpenChange(event.open)}
      size="xl"
      lazyMount
      unmountOnExit
      scrollBehavior="inside"
    >
      <Dialog.Trigger asChild>
        <Button size="xs" variant="outline">
          <LuGitPullRequestCreate /> New pull request
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>New pull request</Dialog.Title>
            </Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
            <Dialog.Body>
              {infoQuery.isPending ? (
                <HStack color="fg.muted" py="4">
                  <Spinner size="sm" />
                  <Text fontSize="sm">Loading branches…</Text>
                </HStack>
              ) : infoQuery.isError ? (
                <Alert.Root status="error" size="sm">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>
                      {infoQuery.error instanceof Error
                        ? infoQuery.error.message.replace(/^.*Error: /, "")
                        : "Couldn’t load the repository’s branches."}
                    </Alert.Description>
                  </Alert.Content>
                </Alert.Root>
              ) : (
                <VStack alignItems="stretch" gap="4">
                  {unpushedLocalBranch && (
                    <Alert.Root status="info" size="sm">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Description>
                          Your local branch{" "}
                          <Text as="span" fontFamily="mono">
                            {unpushedLocalBranch}
                          </Text>{" "}
                          isn’t on GitHub yet. Push it first to open a pull
                          request for it.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert.Root>
                  )}

                  <HStack gap="3" alignItems="flex-end">
                    <BranchSelect
                      label="Base"
                      branches={baseBranches}
                      value={selectedBase}
                      onChange={setBase}
                    />
                    <Box pb="2" color="fg.muted" flexShrink="0">
                      <LuArrowLeft />
                    </Box>
                    <BranchSelect
                      label="Head"
                      branches={headBranches}
                      value={selectedHead}
                      onChange={setHead}
                    />
                  </HStack>

                  <Field.Root>
                    <Field.Label>Title</Field.Label>
                    <Input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Title"
                    />
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>Description</Field.Label>
                    <Box w="full">
                      <MarkdownEditor
                        value={bodyValue}
                        mode={mode}
                        placeholder="Describe the change (markdown supported)"
                        rows={16}
                        onChange={setBody}
                        onModeChange={setMode}
                        onSubmit={() => canCreate && create.mutate()}
                        attachments={{ repo }}
                      />
                    </Box>
                  </Field.Root>

                  <Checkbox.Root
                    size="sm"
                    cursor="pointer"
                    checked={draft}
                    onCheckedChange={(event) =>
                      setDraft(Boolean(event.checked))
                    }
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label>Create as draft</Checkbox.Label>
                  </Checkbox.Root>
                </VStack>
              )}
            </Dialog.Body>
            <Dialog.Footer gap="2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!canCreate}
                loading={create.isPending}
                onClick={() => create.mutate()}
              >
                Create pull request
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

interface BranchItem {
  label: string;
  value: string;
  // The branch's last commit date — shown so the newest-first order is
  // visible. Undefined for a cached response from before dates were fetched.
  date?: string;
}

interface BranchSelectProps {
  label: string;
  branches: BranchItem[];
  value: string;
  onChange(value: string): void;
}

// A searchable branch picker — repos can have hundreds of branches, so typing
// to filter beats scrolling. memo: the dialog re-renders on every
// title/description keystroke, and those renders are what made typing lag.
const BranchSelect = memo(function BranchSelect({
  label,
  branches,
  value,
  onChange,
}: BranchSelectProps) {
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter, set } = useListCollection<BranchItem>({
    initialItems: [],
    filter: contains,
  });
  // The input is controlled so it always shows either the chosen branch or
  // what's being typed — the selection arrives asynchronously, after the
  // branch list loads.
  const [inputValue, setInputValue] = useState(value);

  // biome-ignore lint/correctness/useExhaustiveDependencies: set is a stable store setter
  useEffect(() => {
    set(branches);
  }, [branches]);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  return (
    <Field.Root flex="1" minW="0">
      <Field.Label>{label}</Field.Label>
      <Combobox.Root
        collection={collection}
        value={value ? [value] : []}
        inputValue={inputValue}
        onValueChange={(event) => onChange(event.value[0] ?? "")}
        onInputValueChange={(event) => {
          setInputValue(event.inputValue);
          filter(event.inputValue);
        }}
        onOpenChange={(event) => {
          // Selecting a branch sets the input to its name, which also filters
          // the list down to it — so clear the filter on open, or reopening
          // would show only the branch already chosen. On close, drop any
          // abandoned filter text that would look like a selection.
          filter("");
          if (!event.open) setInputValue(value);
        }}
        openOnClick
        selectionBehavior="replace"
        size="sm"
        width="full"
      >
        <Combobox.Control>
          <Combobox.Input
            placeholder="Select branch"
            fontFamily="mono"
            fontSize="sm"
          />
          <Combobox.IndicatorGroup>
            <Combobox.Trigger />
          </Combobox.IndicatorGroup>
        </Combobox.Control>
        {/* Not portalled: inside a dialog the menu must stay in the dialog's
            stacking context or it renders underneath it. */}
        <Combobox.Positioner>
          <Combobox.Content maxH="280px" overflowY="auto">
            <Combobox.Empty>No branches match.</Combobox.Empty>
            {collection.items.map((item) => (
              <Combobox.Item item={item} key={item.value}>
                <Text fontFamily="mono" fontSize="sm" truncate flex="1">
                  {item.label}
                </Text>
                {item.date && (
                  <RelativeTime
                    iso={item.date}
                    fontSize="2xs"
                    color="fg.subtle"
                    flexShrink="0"
                    mr="1"
                  />
                )}
                <Combobox.ItemIndicator />
              </Combobox.Item>
            ))}
          </Combobox.Content>
        </Combobox.Positioner>
      </Combobox.Root>
    </Field.Root>
  );
});
