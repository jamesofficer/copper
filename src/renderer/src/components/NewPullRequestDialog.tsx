import {
  Alert,
  Box,
  Button,
  Checkbox,
  CloseButton,
  createListCollection,
  Dialog,
  Field,
  HStack,
  Input,
  Portal,
  Select,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { memo, useMemo, useState } from "react";
import { LuArrowLeft, LuGitPullRequestCreate } from "react-icons/lu";
import type { PullRequest } from "../../../shared/types";
import MarkdownEditor, { type MarkdownEditorMode } from "./MarkdownEditor";
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

  // Stable references so the memoized selects skip re-rendering while the
  // user types in the title/description — the branch lists can be huge.
  const headBranches = useMemo(
    () =>
      info ? info.branches.filter((branch) => branch !== selectedBase) : [],
    [info, selectedBase],
  );
  const baseBranches = useMemo(
    () =>
      info ? info.branches.filter((branch) => branch !== selectedHead) : [],
    [info, selectedHead],
  );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(event) => handleOpenChange(event.open)}
      size="lg"
      lazyMount
      unmountOnExit
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
                        rows={6}
                        onChange={setBody}
                        onModeChange={setMode}
                        onSubmit={() => canCreate && create.mutate()}
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

interface BranchSelectProps {
  label: string;
  branches: string[];
  value: string;
  onChange(value: string): void;
}

// memo: the dialog re-renders on every title/description keystroke; with
// hundreds of branches per select, those renders are what made typing lag.
const BranchSelect = memo(function BranchSelect({
  label,
  branches,
  value,
  onChange,
}: BranchSelectProps) {
  const collection = useMemo(
    () =>
      createListCollection({
        items: branches.map((branch) => ({ value: branch, label: branch })),
      }),
    [branches],
  );
  return (
    <Field.Root flex="1" minW="0">
      <Field.Label>{label}</Field.Label>
      <Select.Root
        collection={collection}
        value={value ? [value] : []}
        onValueChange={(event) => onChange(event.value[0] ?? "")}
        size="sm"
        lazyMount
        unmountOnExit
      >
        <Select.HiddenSelect />
        <Select.Control>
          <Select.Trigger cursor="pointer">
            <Select.ValueText placeholder="Select branch" fontFamily="mono" />
          </Select.Trigger>
          <Select.IndicatorGroup>
            <Select.Indicator />
          </Select.IndicatorGroup>
        </Select.Control>
        {/* Not portalled: inside a dialog the menu must stay in the dialog's
            stacking context or it renders underneath it. */}
        <Select.Positioner>
          <Select.Content>
            {collection.items.map((item) => (
              <Select.Item
                item={item}
                key={item.value}
                _checked={{ bg: "bg.emphasized" }}
              >
                <Select.ItemText fontFamily="mono">
                  {item.label}
                </Select.ItemText>
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Select.Root>
    </Field.Root>
  );
});
