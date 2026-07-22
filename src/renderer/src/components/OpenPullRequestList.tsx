import {
  createListCollection,
  HStack,
  Portal,
  Select,
  Text,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import type { PullRequest } from "../../../shared/types";
import {
  filterPullRequests,
  type PullRequestSort,
  sortOptions,
  sortPullRequests,
} from "../lib/prFilters";
import PullRequestCard from "./PullRequestCard";
import UserAvatar from "./UserAvatar";

interface Props {
  prs: PullRequest[];
  preview: PullRequest | null;
  onSelect(pr: PullRequest): void;
}

interface FilterItem {
  value: string;
  label: string;
  // GitHub login to show an avatar for — absent on "All …"/sort options.
  avatar?: string;
}

interface FilterSelectProps {
  label: string;
  items: FilterItem[];
  value: string;
  width?: string;
  onChange(value: string): void;
}

function FilterSelect({
  label,
  items,
  value,
  width = "150px",
  onChange,
}: FilterSelectProps) {
  const collection = useMemo(() => createListCollection({ items }), [items]);
  return (
    <Select.Root
      collection={collection}
      value={[value]}
      onValueChange={(event) => onChange(event.value[0] ?? "all")}
      size="xs"
      width={width}
    >
      <Select.HiddenSelect />
      <Select.Control>
        <Select.Trigger cursor="pointer">
          <Select.ValueText placeholder={label} />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal>
        <Select.Positioner>
          <Select.Content>
            {collection.items.map((item) => (
              <Select.Item item={item} key={item.value}>
                <HStack gap="2" flex="1" minW="0">
                  {item.avatar && <UserAvatar username={item.avatar} />}
                  <Select.ItemText>{item.label}</Select.ItemText>
                </HStack>
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  );
}

// The selected repo's open PRs with GitHub-style filters. Filtering is
// client-side — the full open list is already loaded. Mounted with
// key={repo slug} so filters reset when switching repos.
export default function OpenPullRequestList({ prs, preview, onSelect }: Props) {
  const [author, setAuthor] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [sort, setSort] = useState<PullRequestSort>("newest");

  const authorItems = useMemo(() => {
    const logins = [...new Set(prs.map((pr) => pr.author))].sort();
    return [
      { value: "all", label: "All authors" },
      ...logins.map((login) => ({ value: login, label: login, avatar: login })),
    ];
  }, [prs]);

  const assigneeItems = useMemo(() => {
    const logins = [...new Set(prs.flatMap((pr) => pr.assignees ?? []))].sort();
    return [
      { value: "all", label: "All assignees" },
      { value: "none", label: "Assigned to nobody" },
      ...logins.map((login) => ({ value: login, label: login, avatar: login })),
    ];
  }, [prs]);

  const visible = useMemo(
    () => sortPullRequests(filterPullRequests(prs, author, assignee), sort),
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
          onChange={(value) => setSort(value as PullRequestSort)}
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
