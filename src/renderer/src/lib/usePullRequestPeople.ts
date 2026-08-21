import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PullRequestDetail } from "../../../shared/types";
import { toaster } from "../components/ui/toaster";
import {
  type PullRequestPeopleKind,
  peopleOptions,
  setPersonSelected,
} from "./peopleSelection";

interface Args {
  detail: PullRequestDetail;
  kind: PullRequestPeopleKind;
  open: boolean;
}

interface PullRequestPeopleState {
  selected: string[];
  options: string[];
  loading: boolean;
  error: boolean;
  pending: boolean;
  setSelected(login: string, selected: boolean): void;
}

export function usePullRequestPeople({
  detail,
  kind,
  open,
}: Args): PullRequestPeopleState {
  const queryClient = useQueryClient();
  const detailKey = ["pullRequest", detail.repo, detail.number] as const;
  const peopleQuery = useQuery({
    queryKey: ["repositoryPeople", detail.repo],
    queryFn: () => window.api.listRepositoryPeople(detail.repo),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationKey: ["setPullRequestPeople", detail.repo, detail.number, kind],
    mutationFn: ({ login, selected }: { login: string; selected: boolean }) =>
      kind === "reviewers"
        ? window.api.setPullRequestReviewer(
            detail.repo,
            detail.number,
            login,
            selected,
          )
        : window.api.setPullRequestAssignee(
            detail.repo,
            detail.number,
            login,
            selected,
          ),
    onMutate: async ({ login, selected }) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous =
        queryClient.getQueryData<PullRequestDetail>(detailKey) ?? detail;
      queryClient.setQueryData<PullRequestDetail>(detailKey, {
        ...previous,
        [kind]: setPersonSelected(previous[kind], login, selected),
      });
      return { previous };
    },
    onError: (cause, _variables, context) => {
      if (context) queryClient.setQueryData(detailKey, context.previous);
      toaster.create({
        type: "error",
        title:
          kind === "reviewers"
            ? "Couldn’t update reviewers"
            : "Couldn’t update assignees",
        description:
          cause instanceof Error
            ? cause.message.replace(/^.*Error: /, "")
            : String(cause),
        closable: true,
      });
    },
    onSettled: () => {
      for (const key of [
        detailKey,
        ["pullRequests"],
        ["reviewRequests"],
        ["myPullRequests"],
        ["reviewDecision", detail.repo, detail.number],
      ]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  const selected = detail[kind];
  const candidates = peopleQuery.data?.[kind] ?? [];
  return {
    selected,
    options: peopleOptions(
      candidates,
      selected,
      kind === "reviewers" ? [detail.author] : [],
    ),
    loading: peopleQuery.isPending,
    error: peopleQuery.isError,
    pending: mutation.isPending,
    setSelected: (login, selected) => mutation.mutate({ login, selected }),
  };
}
