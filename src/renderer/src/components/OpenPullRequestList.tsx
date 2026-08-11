import { Box, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import type { PullRequest } from "../../../shared/types";
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
import PullRequestQueueRow from "./PullRequestQueueRow";
import QueueFilterBar from "./QueueFilterBar";

interface Props {
  prs: PullRequest[];
  preview: PullRequest | null;
  onSelect(pr: PullRequest): void;
  onOpen(pr: PullRequest): void;
}

// The selected repo's open PRs as the review queue's rows. Filtering is
// client-side — the full open list is already loaded. Mounted with
// key={repo slug} so filters reset when switching repos.
export default function OpenPullRequestList({
  prs,
  preview,
  onSelect,
  onOpen,
}: Props) {
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [sort, setSort] = useState<ListSort>("newest");

  const authorItems = useMemo(() => authorOptions(prs), [prs]);
  const assigneeItems = useMemo(() => assigneeOptions(prs), [prs]);

  const visible = useMemo(
    () =>
      sortListItems(
        filterByText(filterByPeople(prs, author, assignee), text),
        sort,
      ),
    [prs, author, assignee, text, sort],
  );
  const timeField = sortTimeField(sort);

  return (
    <>
      <QueueFilterBar
        placeholder="Filter pull requests"
        value={text}
        onChange={setText}
        filtersActive={
          author !== "all" || assignee !== "all" || sort !== "newest"
        }
      >
        <FilterSelect
          label="Author"
          items={authorItems}
          value={author}
          width="full"
          onChange={setAuthor}
        />
        <FilterSelect
          label="Assignee"
          items={assigneeItems}
          value={assignee}
          width="full"
          onChange={setAssignee}
        />
        <FilterSelect
          label="Sort"
          items={sortOptions}
          value={sort}
          width="full"
          onChange={(value) => setSort(value as ListSort)}
        />
      </QueueFilterBar>

      <Box
        flex="1"
        minH="0"
        overflowY="auto"
        borderTopWidth="1px"
        css={scrollbar}
      >
        {visible.length === 0 ? (
          <Text fontSize="sm" color="fg.muted" px="4" py="4">
            No pull requests match these filters.
          </Text>
        ) : (
          visible.map((pr) => (
            <PullRequestQueueRow
              key={`${pr.repo}#${pr.number}`}
              pr={pr}
              time={pr[timeField]}
              onSelect={onSelect}
              onOpen={onOpen}
              selected={
                preview?.repo === pr.repo && preview?.number === pr.number
              }
            />
          ))
        )}
      </Box>
    </>
  );
}
