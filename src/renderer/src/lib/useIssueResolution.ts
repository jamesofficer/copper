import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toaster } from "../components/ui/toaster";

// Sets or clears an issue's resolution — works for findings and risks alike,
// since both key into the same main-process resolution store. Risk
// resolutions join onto the analysis at read time, so both queries refetch.
export function useIssueResolution(repo: string, prNumber: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      id: string;
      resolution: "accepted" | "dismissed" | "open";
    }) =>
      window.api.setFindingResolution(
        repo,
        prNumber,
        params.id,
        params.resolution,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["findings", repo, prNumber],
      });
      void queryClient.invalidateQueries({
        queryKey: ["analysis", repo, prNumber],
      });
    },
    onError: (cause) => {
      toaster.create({
        type: "error",
        title: "Couldn’t update issue",
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
    },
  });
}
