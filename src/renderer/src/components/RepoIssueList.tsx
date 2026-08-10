import { HStack, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import type { RepoIssue } from "../../../shared/types";
import {
  assigneeOptions,
  authorOptions,
  filterByPeople,
  type ListSort,
  sortListItems,
  sortOptions,
} from "../lib/listFilters";
import FilterSelect from "./FilterSelect";
import RepoIssueCard from "./RepoIssueCard";

interface Props {
  issues: RepoIssue[];
  preview: RepoIssue | null;
  onSelect(issue: RepoIssue): void;
}

// The selected repo's open issues, filtered client-side like the PR list —
// the whole open list is already loaded. Mounted with key={repo slug} so
// filters reset when switching repos.
export default function RepoIssueList({ issues, preview, onSelect }: Props) {
  const [author, setAuthor] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [sort, setSort] = useState<ListSort>("newest");

  const authorItems = useMemo(() => authorOptions(issues), [issues]);
  const assigneeItems = useMemo(() => assigneeOptions(issues), [issues]);

  const visible = useMemo(
    () => sortListItems(filterByPeople(issues, author, assignee), sort),
    [issues, author, assignee, sort],
  );

  return (
    <>
      <HStack gap="2" maxW="2xl" flexWrap="wrap">
        <FilterSelect
          label="Author"
          items={authorItems}
          value={author}
          onChange={setAuthor}
        />
        <FilterSelect
          label="Assignee"
          items={assigneeItems}
          value={assignee}
          onChange={setAssignee}
        />
        <FilterSelect
          label="Sort"
          items={sortOptions}
          value={sort}
          width="180px"
          onChange={(value) => setSort(value as ListSort)}
        />
      </HStack>

      {visible.length === 0 ? (
        <Text fontSize="sm" color="fg.muted" py="4">
          No issues match these filters.
        </Text>
      ) : (
        visible.map((issue) => (
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
    </>
  );
}
