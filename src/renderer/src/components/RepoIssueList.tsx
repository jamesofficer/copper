import { HStack, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { REPO_ISSUE_LIMIT, type RepoIssue } from "../../../shared/types";
import {
  assigneeOptions,
  authorOptions,
  filterByPeople,
  type ListSort,
  sortListItems,
  sortOptions,
} from "../lib/listFilters";
import FilterSelect from "./FilterSelect";
import ListPagination from "./ListPagination";
import RepoIssueCard from "./RepoIssueCard";

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
  const [author, setAuthor] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [sort, setSort] = useState<ListSort>("newest");
  const [requestedPage, setRequestedPage] = useState(1);

  const authorItems = useMemo(() => authorOptions(issues), [issues]);
  const assigneeItems = useMemo(() => assigneeOptions(issues), [issues]);

  const visible = useMemo(
    () => sortListItems(filterByPeople(issues, author, assignee), sort),
    [issues, author, assignee, sort],
  );

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

  return (
    <>
      <HStack gap="2" maxW="2xl" flexWrap="wrap">
        <FilterSelect
          label="Author"
          items={authorItems}
          value={author}
          onChange={(value) => changeFilter(() => setAuthor(value))}
        />
        <FilterSelect
          label="Assignee"
          items={assigneeItems}
          value={assignee}
          onChange={(value) => changeFilter(() => setAssignee(value))}
        />
        <FilterSelect
          label="Sort"
          items={sortOptions}
          value={sort}
          width="180px"
          onChange={(value) => changeFilter(() => setSort(value as ListSort))}
        />
      </HStack>

      {/* The list is the newest slice, not everything open, so filters run over
          a subset — say so rather than let "no issues match" imply none exist. */}
      {issues.length >= REPO_ISSUE_LIMIT && (
        <Text fontSize="xs" color="fg.muted">
          Showing the {REPO_ISSUE_LIMIT} most recently updated open issues.
          Older ones aren’t loaded, so filters only search these.
        </Text>
      )}

      {visible.length === 0 ? (
        <Text fontSize="sm" color="fg.muted" py="4">
          No issues match these filters.
        </Text>
      ) : (
        shown.map((issue) => (
          <RepoIssueCard
            key={`${issue.repo}#${issue.number}`}
            issue={issue}
            onSelect={onSelect}
            selected={
              preview?.repo === issue.repo && preview?.number === issue.number
            }
            maxW="2xl"
          />
        ))
      )}

      <ListPagination
        count={visible.length}
        pageSize={PAGE_SIZE}
        page={page}
        onPageChange={setRequestedPage}
      />
    </>
  );
}
