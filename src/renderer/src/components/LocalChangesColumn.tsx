import {
  Box,
  Button,
  Collapsible,
  Flex,
  Heading,
  HStack,
  Input,
  InputGroup,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  LuChevronRight,
  LuMinus,
  LuPlus,
  LuSearch,
  LuUndo2,
} from "react-icons/lu";
import type { PullRequestFile } from "../../../shared/types";
import { errorText } from "../lib/ipcError";
import { localChangesBulkLabel } from "../lib/localChangesSelection";
import { scrollbar } from "../lib/scrollbar";
import type { LocalChangesState } from "../lib/useLocalChanges";
import BranchLabel from "./BranchLabel";
import CommitComposer from "./CommitComposer";
import CommitsPanel from "./CommitsPanel";
import DiscardChangesDialog from "./DiscardChangesDialog";
import FileList, { type RowAction } from "./FileList";
import WorktreeSelect from "./WorktreeSelect";

interface Props {
  state: LocalChangesState;
}

// The Changes tab's left column: which checkout is being read, the files in it
// — the uncommitted work split the way git sees it, or one commit's changes —
// the branch's commits, and the commit box. The PR-only affordances
// (commenting, viewed state, context expansion) stay out.
export default function LocalChangesColumn({ state }: Props) {
  const {
    worktree,
    path,
    branch,
    switchable,
    filter,
    setFilter,
    filtering,
    commit,
    commits,
    commitList,
    commitFiles,
    commitFileTotal,
    changedPaths,
    commitFileCount,
    staged,
    unstaged,
    writesPending,
  } = state;

  return (
    <Flex direction="column" flex="1" minW="0" minH="0">
      {/* Which checkout everything below is read from, at the head of the
          column rather than in the window's top bar: it belongs with the files
          it decides. Headed and separated like the sections under it, so the
          column reads as one stack of sections. */}
      {(switchable || branch) && (
        <Box flexShrink="0" borderBottomWidth="1px">
          <HStack px="4" py="3">
            <SectionHeading>
              {switchable ? "Worktree" : "Branch"}
            </SectionHeading>
          </HStack>
          <Box px="3" pb="3">
            {switchable ? (
              <WorktreeSelect
                worktrees={worktree.worktrees ?? []}
                value={path}
                onChange={worktree.select}
              />
            ) : (
              branch && (
                <Box px="1">
                  <BranchLabel name={branch} />
                </Box>
              )
            )}
          </Box>
        </Box>
      )}

      <Box px="3" pt="3" pb="2" flexShrink="0">
        <InputGroup startElement={<LuSearch size={12} />}>
          <Input
            size="xs"
            placeholder="Filter files"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setFilter("");
            }}
          />
        </InputGroup>
      </Box>
      {/* minH="0" is what makes it scroll: a flex item's default min-height
          is its content, so without it a long list pushes the panels below it
          off the bottom instead of overflowing. */}
      <Box flex="1" minH="0" overflowY="auto" px="3" pb="3" css={scrollbar}>
        {commit ? (
          state.commitFilesPending ? (
            <Loading text="Reading the commit…" />
          ) : state.commitFilesError ? (
            <ErrorText>
              {errorText(state.commitFilesError, "Couldn't read commit.")}
            </ErrorText>
          ) : commitFiles.length === 0 ? (
            <Text fontSize="sm" color="fg.muted" px="1">
              {commitFileTotal > 0
                ? "No files match your filter."
                : "This commit changed no files."}
            </Text>
          ) : (
            <>
              <HStack px="1" pb="1">
                <SectionHeading>
                  Files{commitFileCount ? ` (${commitFileCount})` : ""}
                </SectionHeading>
              </HStack>
              <FileList
                files={commitFiles}
                selectedPath={state.selectedCommitPath}
                onSelect={state.selectCommitFile}
              />
            </>
          )
        ) : state.changesPending ? (
          <Loading text="Reading local changes…" />
        ) : state.changesError ? (
          <ErrorText>
            {errorText(state.changesError, "Couldn't read local changes.")}
          </ErrorText>
        ) : staged.length === 0 && unstaged.length === 0 ? (
          <Text fontSize="sm" color="fg.muted" px="1">
            {changedPaths > 0
              ? "No files match your filter."
              : "No uncommitted changes."}
          </Text>
        ) : (
          <Stack gap="4">
            <FileGroup
              title="Staged"
              files={staged}
              selectedPath={
                state.selectedArea === "staged" ? state.selectedPath : null
              }
              onSelect={(file) => state.selectFile("staged", file)}
              bulkLabel={localChangesBulkLabel("staged", filtering)}
              onBulk={state.unstage}
              busy={writesPending}
              nameColor="green.fg"
              actions={[
                {
                  icon: <LuMinus />,
                  label: "Unstage",
                  disabled: writesPending,
                  onRun: (file) => state.unstage([file]),
                },
              ]}
            />
            <FileGroup
              title="Unstaged changes"
              files={unstaged}
              selectedPath={
                state.selectedArea === "unstaged" ? state.selectedPath : null
              }
              onSelect={(file) => state.selectFile("unstaged", file)}
              bulkLabel={localChangesBulkLabel("unstaged", filtering)}
              onBulk={state.stage}
              busy={writesPending}
              actions={[
                {
                  icon: <LuUndo2 />,
                  label: "Discard",
                  disabled: writesPending,
                  onRun: (file) => state.setDiscarding([file]),
                },
                {
                  icon: <LuPlus />,
                  label: "Stage",
                  disabled: writesPending,
                  onRun: (file) => state.stage([file]),
                },
              ]}
            />
          </Stack>
        )}
      </Box>

      {commits.length > 0 && (
        <CommitsPanel
          commits={commits}
          selectedSha={commit?.sha ?? null}
          onSelect={state.selectCommit}
          allLabel="Uncommitted changes"
          newestFirst
          hint={commitList?.base ? `vs ${commitList.base}` : "recent"}
        />
      )}
      {/* Committing belongs to the index alone, so reading a past commit
          disables the box rather than removing it — a commit box under a past
          commit's files would read as an offer to change that commit, and
          unmounting it would shift everything above it as commits are picked. */}
      <CommitComposer
        path={path}
        stagedCount={state.stagedCount}
        disabled={Boolean(commit)}
      />
      <DiscardChangesDialog
        repoPath={path}
        paths={state.discarding}
        untracked={state.untracked}
        onClose={() => state.setDiscarding(null)}
      />
    </Flex>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Heading
      size="xs"
      color="fg.muted"
      textTransform="uppercase"
      letterSpacing="wider"
    >
      {children}
    </Heading>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <HStack color="fg.muted" px="1">
      <Spinner size="sm" />
      <Text fontSize="sm">{text}</Text>
    </HStack>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <Text fontSize="sm" color="fg.error" px="1">
      {children}
    </Text>
  );
}

interface GroupProps {
  title: string;
  files: PullRequestFile[];
  selectedPath: string | null;
  onSelect(path: string): void;
  bulkLabel: string;
  onBulk(paths: string[]): void;
  actions: RowAction[];
  busy: boolean;
  // Tints the file names; the staged group carries its state on every row.
  nameColor?: string;
}

// One side of the index, with its bulk action in the header. Empty groups
// render nothing — an empty "Staged" heading is noise.
function FileGroup({
  title,
  files,
  selectedPath,
  onSelect,
  bulkLabel,
  onBulk,
  actions,
  busy,
  nameColor,
}: GroupProps) {
  if (files.length === 0) return null;

  return (
    // Open by default: a collapsed group would hide work from the person
    // deciding what to commit. The trigger and the bulk action are siblings,
    // not nested — Collapsible.Trigger is itself a button.
    <Collapsible.Root defaultOpen>
      <HStack px="1" gap="1">
        <Collapsible.Trigger flex="1" cursor="pointer" textAlign="left">
          <HStack gap="1.5" color="fg.muted">
            <SectionHeading>
              {title} ({files.length})
            </SectionHeading>
            <Collapsible.Indicator
              ml="auto"
              transition="transform 0.2s"
              _open={{ transform: "rotate(90deg)" }}
            >
              <LuChevronRight size="12" />
            </Collapsible.Indicator>
          </HStack>
        </Collapsible.Trigger>
        <Button
          size="2xs"
          variant="ghost"
          disabled={busy}
          onClick={() => onBulk(files.map((file) => file.path))}
        >
          {bulkLabel}
        </Button>
      </HStack>
      <Collapsible.Content>
        <Box pt="1">
          <FileList
            files={files}
            selectedPath={selectedPath}
            onSelect={onSelect}
            rowActions={actions}
            nameColor={nameColor}
          />
        </Box>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
