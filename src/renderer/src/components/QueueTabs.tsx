import { Badge, Tabs } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import type { Repository } from "../../../shared/types";
import {
  pullRequestsQueryOptions,
  repoCountsQueryOptions,
  repoIssuesQueryOptions,
} from "../lib/repoQueries";
import { localChangeCountQueryOptions } from "../lib/useLocalChanges";
import type { QueueTab } from "./QueueHeader";

interface Props {
  repo: Repository | null;
  tab: QueueTab;
  // The checkout the Changes count is read from.
  checkoutPath: string;
}

// The queue's tab triggers. On the two list tabs the bar caps the queue
// column; on Changes it caps the file-list column, so the diff beside it can
// start directly under the top bar. Its counts come from the same shared query
// entries the panels read, so a second observer costs nothing.
export default function QueueTabs({ repo, tab, checkoutPath }: Props) {
  const slug = repo?.slug ?? undefined;
  const prsQuery = useQuery(pullRequestsQueryOptions(slug));
  const issuesQuery = useQuery(repoIssuesQueryOptions(slug, tab === "issues"));
  const countsQuery = useQuery(repoCountsQueryOptions());
  // The always-visible badge uses porcelain status only. Building every file
  // patch is deferred until the Changes tab opens.
  const countQuery = useQuery({
    ...localChangeCountQueryOptions(checkoutPath),
    enabled: Boolean(repo),
  });

  const counts = slug ? countsQuery.data?.[slug] : undefined;

  return (
    // No icons on the triggers: the column is narrow, and the counts are the
    // part that says where the work is. The loaded lists are the fallback, for
    // a repo the counts query couldn't reach (no token, no access).
    // The line variant's own bottom border is kept (it used to be turned off
    // with border="none"): it separates the tabs from the column below them,
    // and the active trigger's indicator sits on top of it.
    <Tabs.List flexShrink="0" px="4" gap="4" whiteSpace="nowrap">
      <Tabs.Trigger value="pull-requests" px="0" py="2.5">
        Open
        <TabCount value={counts?.pullRequests ?? prsQuery.data?.length} />
      </Tabs.Trigger>
      <Tabs.Trigger value="issues" px="0" py="2.5">
        Issues
        <TabCount value={counts?.issues ?? issuesQuery.data?.length} />
      </Tabs.Trigger>
      <Tabs.Trigger value="local-changes" px="0" py="2.5">
        Changes
        <TabCount value={countQuery.data} />
      </Tabs.Trigger>
    </Tabs.List>
  );
}

function TabCount({ value }: { value?: number }) {
  if (value === undefined) return null;
  return (
    <Badge size="xs" variant="surface" colorPalette="gray">
      {value}
    </Badge>
  );
}
