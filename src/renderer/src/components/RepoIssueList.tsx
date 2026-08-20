import { Box, Text } from "@chakra-ui/react";
import { useMemo, useRef } from "react";
import { REPO_ISSUE_LIMIT, type RepoIssue } from "../../../shared/types";
import {
  applyQueueFilters,
  type QueueFilters,
  sortTimeField,
} from "../lib/listFilters";
import { scrollbar } from "../lib/scrollbar";
import ListPagination from "./ListPagination";
import QueueFilterBar from "./QueueFilterBar";
import RepoIssueQueueRow from "./RepoIssueQueueRow";

const PAGE_SIZE = 25;

interface Props {
  issues: RepoIssue[];
  preview: RepoIssue | null;
  filters: QueueFilters;
  requestedPage: number;
  onSelect(issue: RepoIssue): void;
  onFiltersChange(filters: QueueFilters): void;
  onPageChange(page: number): void;
}

// One repository's open issues. The list filters the loaded data on the
// client. Its top-level tab owns the filters and page, so they survive a tab
// switch and an app restart.
export default function RepoIssueList({
  issues,
  preview,
  filters,
  requestedPage,
  onSelect,
  onFiltersChange,
  onPageChange,
}: Props) {
  const topRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(
    () => applyQueueFilters(issues, filters),
    [issues, filters],
  );
  const timeField = sortTimeField(filters.sort);

  // Clamped rather than stored outright, so a refetch that returns fewer issues
  // can't leave the list on a page that no longer exists.
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const shown = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Every filter change starts from the top: page 3 of the old filter says
  // nothing about where the new one's results are.
  function changeFilters(next: QueueFilters) {
    onFiltersChange(next);
    onPageChange(1);
  }

  // The controls sit at the foot of the list, so the click that turns the page
  // leaves the reader at the bottom of it — looking at the last row of the new
  // page instead of the first. scrollIntoView finds whichever ancestor scrolls,
  // which this component deliberately doesn't know.
  function goToPage(next: number) {
    onPageChange(next);
    topRef.current?.scrollIntoView({ block: "start" });
  }

  return (
    <>
      <QueueFilterBar
        placeholder="Filter issues"
        filters={filters}
        onChange={changeFilters}
        items={issues}
      />

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

        <Box px="4">
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
