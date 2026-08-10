import { HStack, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import type { PullRequest } from "../../../shared/types";
import {
  assigneeOptions,
  authorOptions,
  filterByPeople,
  type ListSort,
  sortListItems,
  sortOptions,
} from "../lib/listFilters";
import FilterSelect from "./FilterSelect";
import PullRequestCard from "./PullRequestCard";

interface Props {
  prs: PullRequest[];
  preview: PullRequest | null;
  onSelect(pr: PullRequest): void;
  onOpen(pr: PullRequest): void;
}

// The selected repo's open PRs with GitHub-style filters. Filtering is
// client-side — the full open list is already loaded. Mounted with
// key={repo slug} so filters reset when switching repos.
export default function OpenPullRequestList({
  prs,
  preview,
  onSelect,
  onOpen,
}: Props) {
  const [author, setAuthor] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [sort, setSort] = useState<ListSort>("newest");

  const authorItems = useMemo(() => authorOptions(prs), [prs]);
  const assigneeItems = useMemo(() => assigneeOptions(prs), [prs]);

  const visible = useMemo(
    () => sortListItems(filterByPeople(prs, author, assignee), sort),
    [prs, author, assignee, sort],
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
          No pull requests match these filters.
        </Text>
      ) : (
        visible.map((pr) => (
          <PullRequestCard
            key={`${pr.repo}#${pr.number}`}
            pr={pr}
            onSelect={onSelect}
            onOpen={onOpen}
            selected={
              preview?.repo === pr.repo && preview?.number === pr.number
            }
            maxW="2xl"
          />
        ))
      )}
    </>
  );
}
