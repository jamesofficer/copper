import { Box, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import type { PullRequest } from "../../../shared/types";
import {
  applyQueueFilters,
  defaultQueueFilters,
  type QueueFilters,
  sortTimeField,
} from "../lib/listFilters";
import { scrollbar } from "../lib/scrollbar";
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
  const [filters, setFilters] = useState<QueueFilters>(defaultQueueFilters);

  const visible = useMemo(
    () => applyQueueFilters(prs, filters),
    [prs, filters],
  );
  const timeField = sortTimeField(filters.sort);

  return (
    <>
      <QueueFilterBar
        placeholder="Filter pull requests"
        filters={filters}
        onChange={setFilters}
        items={prs}
      />

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
