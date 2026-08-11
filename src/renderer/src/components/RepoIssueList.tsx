import { Box, Text } from "@chakra-ui/react";
import { useMemo, useRef, useState } from "react";
import { REPO_ISSUE_LIMIT, type RepoIssue } from "../../../shared/types";
import {
  assigneeOptions,
  authorOptions,
  filterByPeople,
  filterByText,
  type ListSort,
  sortListItems,
  sortOptions,
  sortTimeField,
} from "../lib/listFilters";
import { scrollbar } from "../lib/scrollbar";
import FilterSelect from "./FilterSelect";
import ListPagination from "./ListPagination";
import QueueFilterBar from "./QueueFilterBar";
import RepoIssueQueueRow from "./RepoIssueQueueRow";

const PAGE_SIZE = 25;

interface Props {
  issues: RepoIssue[];
  preview: RepoIssue | null;
  onSelect(issue: RepoIssue): void;
}

// The selected repo's open issues, filtered client-side like the PR list —
// the whole loaded list is already in memory. Mounted with key={repo slug} so
// filters reset when switching repos.
export default function RepoIssueList({ issues, preview, onSelect }: Props) {
  const topRef = useRef<HTMLDivElement>(null);

  const [text, setText] = useState("");
  const [author, setAuthor] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [sort, setSort] = useState<ListSort>("newest");
  const [requestedPage, setRequestedPage] = useState(1);

  const authorItems = useMemo(() => authorOptions(issues), [issues]);
  const assigneeItems = useMemo(() => assigneeOptions(issues), [issues]);

  const visible = useMemo(
    () =>
      sortListItems(
        filterByText(filterByPeople(issues, author, assignee), text),
        sort,
      ),
    [issues, author, assignee, text, sort],
  );

  const timeField = sortTimeField(sort);

  // Clamped rather than stored outright, so a refetch that returns fewer issues
  // can't leave the list on a page that no longer exists.
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const shown = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Every filter change starts from the top: page 3 of the old filter says
  // nothing about where the new one's results are.
  function changeFilter(apply: () => void) {
    apply();
    setRequestedPage(1);
  }

  // The controls sit at the foot of the list, so the click that turns the page
  // leaves the reader at the bottom of it — looking at the last row of the new
  // page instead of the first. scrollIntoView finds whichever ancestor scrolls,
  // which this component deliberately doesn't know.
  function goToPage(next: number) {
    setRequestedPage(next);
    topRef.current?.scrollIntoView({ block: "start" });
  }

  return (
    <>
      <QueueFilterBar
        placeholder="Filter issues"
        value={text}
        onChange={(value) => changeFilter(() => setText(value))}
        filtersActive={
          author !== "all" || assignee !== "all" || sort !== "newest"
        }
      >
        <FilterSelect
          label="Author"
          items={authorItems}
          value={author}
          width="full"
          onChange={(value) => changeFilter(() => setAuthor(value))}
        />
        <FilterSelect
          label="Assignee"
          items={assigneeItems}
          value={assignee}
          width="full"
          onChange={(value) => changeFilter(() => setAssignee(value))}
        />
        <FilterSelect
          label="Sort"
          items={sortOptions}
          value={sort}
          width="full"
          onChange={(value) => changeFilter(() => setSort(value as ListSort))}
        />
      </QueueFilterBar>

      <Box
        flex="1"
        minH="0"
        overflowY="auto"
        borderTopWidth="1px"
        css={scrollbar}
      >
        <Box ref={topRef} />

        {/* The list is the newest slice, not everything open, so filters run
            over a subset — say so rather than let "no issues match" imply none
            exist. */}
        {issues.length >= REPO_ISSUE_LIMIT && (
          <Text fontSize="xs" color="fg.muted" px="4" py="2">
            Showing the {REPO_ISSUE_LIMIT} most recently updated open issues.
            Older ones aren’t loaded, so filters only search these.
          </Text>
        )}

        {visible.length === 0 ? (
          <Text fontSize="sm" color="fg.muted" px="4" py="4">
            No issues match these filters.
          </Text>
        ) : (
          shown.map((issue) => (
            <RepoIssueQueueRow
              key={`${issue.repo}#${issue.number}`}
              issue={issue}
              time={issue[timeField]}
              onSelect={onSelect}
              selected={
                preview?.repo === issue.repo && preview?.number === issue.number
              }
            />
          ))
        )}

        <Box px="4" py="3">
          <ListPagination
            count={visible.length}
            pageSize={PAGE_SIZE}
            page={page}
            onPageChange={goToPage}
          />
        </Box>
      </Box>
    </>
  );
}
