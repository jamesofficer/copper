import {
  Badge,
  Combobox,
  Portal,
  Spinner,
  Text,
  useFilter,
  useListCollection,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { PullRequestDetail } from "../../../shared/types";
import { toaster } from "./ui/toaster";

interface Props {
  detail: PullRequestDetail;
}

interface BranchItem {
  label: string;
  value: string;
}

// The PR's base branch, editable in place for open PRs — GitHub retargets the
// PR onto the chosen branch. A searchable combobox so long branch lists are
// filterable; branches keep getBranchInfo's newest-commit-first order.
// Closed and merged PRs show a plain badge.
export default function BaseBranchSelect({ detail }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const editable = detail.state === "open" && !detail.merged;

  const branchesQuery = useQuery({
    queryKey: ["branchInfo", detail.repo],
    queryFn: () => window.api.getBranchInfo(detail.repo),
    enabled: editable && open,
  });

  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter, set } = useListCollection<BranchItem>({
    initialItems: [],
    filter: contains,
  });

  // Populate once the branches load. Can't retarget onto the branch the PR is
  // coming from, so drop the head. Order is preserved (newest commit first).
  // biome-ignore lint/correctness/useExhaustiveDependencies: set is a stable store setter; data drives this
  useEffect(() => {
    if (!branchesQuery.data) return;
    set(
      branchesQuery.data.branches
        .filter((branch) => branch !== detail.headRef)
        .map((branch) => ({ label: branch, value: branch })),
    );
  }, [branchesQuery.data, detail.headRef]);

  const retarget = useMutation({
    mutationFn: (base: string) =>
      window.api.setPullRequestBase(detail.repo, detail.number, base),
    onSuccess: (_result, base) => {
      toaster.create({
        type: "success",
        title: "Base branch changed",
        description: `${detail.repo}#${detail.number} now targets ${base}.`,
      });
      // The base drives the whole comparison — refresh the detail and the
      // diff/commits, plus the merge gate and open-PR lists.
      for (const key of [
        ["pullRequest", detail.repo, detail.number],
        ["pullRequestFiles", detail.repo, detail.number],
        ["pullRequestCommits", detail.repo, detail.number],
        ["reviewDecision", detail.repo, detail.number],
        ["pullRequests"],
      ]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
    onError: (cause) => {
      toaster.create({
        type: "error",
        title: "Couldn’t change the base branch",
        description:
          cause instanceof Error
            ? cause.message.replace(/^.*Error: /, "")
            : String(cause),
        closable: true,
      });
    },
  });

  if (!editable) {
    return <Badge variant="outline">{detail.baseRef}</Badge>;
  }

  return (
    <Combobox.Root
      collection={collection}
      value={[detail.baseRef]}
      open={open}
      onOpenChange={(details) => setOpen(details.open)}
      onInputValueChange={(details) => filter(details.inputValue)}
      onValueChange={(details) => {
        const next = details.value[0];
        if (next && next !== detail.baseRef) retarget.mutate(next);
      }}
      disabled={retarget.isPending}
      openOnClick
      width="240px"
      size="sm"
      positioning={{ placement: "bottom-start" }}
    >
      <Combobox.Control>
        <Combobox.Input
          placeholder={detail.baseRef}
          fontFamily="mono"
          fontSize="sm"
        />
        <Combobox.IndicatorGroup>
          {retarget.isPending ? <Spinner size="xs" /> : <Combobox.Trigger />}
        </Combobox.IndicatorGroup>
      </Combobox.Control>
      <Portal>
        <Combobox.Positioner>
          <Combobox.Content maxH="320px" overflowY="auto">
            {branchesQuery.isPending ? (
              <Text px="3" py="2" fontSize="sm" color="fg.muted">
                Loading branches…
              </Text>
            ) : branchesQuery.isError ? (
              <Text px="3" py="2" fontSize="sm" color="fg.error">
                Couldn’t load branches.
              </Text>
            ) : (
              <>
                <Combobox.Empty>No branches match.</Combobox.Empty>
                {collection.items.map((item) => (
                  <Combobox.Item item={item} key={item.value}>
                    <Text fontFamily="mono" fontSize="sm" truncate>
                      {item.label}
                    </Text>
                    <Combobox.ItemIndicator />
                  </Combobox.Item>
                ))}
              </>
            )}
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  );
}
