import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { LuCircle, LuCircleCheck, LuCircleDot } from "react-icons/lu";
import type {
  AnalysisResult,
  PullRequestDetail,
  PullRequestReview,
} from "../../../shared/types";

// Where the reviewer is in their own pass over this PR. Every step is read
// from state the app already keeps — a cached analysis, GitHub's viewed-file
// checkboxes, the local draft comments — so the rail can never claim progress
// the reviewer didn't make.
export type StepState = "done" | "in_progress" | "pending";

export interface ReviewStep {
  id: "summary" | "files" | "submit";
  label: string;
  state: StepState;
  detail: string;
}

export interface ReviewProgressInput {
  detail: PullRequestDetail;
  analysis: AnalysisResult | null | undefined;
  viewedFiles: string[];
  draftCount: number;
  reviews: PullRequestReview[];
  viewer: string | undefined;
}

// An analysis is only "read" while it still describes the commit on screen;
// one run against an older head is stale progress, not progress.
function summaryStep(
  detail: PullRequestDetail,
  analysis: AnalysisResult | null | undefined,
): ReviewStep {
  if (!analysis) {
    return {
      id: "summary",
      label: "Read summary",
      state: "pending",
      detail: "Not analysed",
    };
  }
  const current = analysis.headSha === detail.headSha;
  return {
    id: "summary",
    label: "Read summary",
    state: current ? "done" : "in_progress",
    detail: current ? "Done" : "Older commit",
  };
}

// Counting is enough here, without intersecting the paths against the
// changelist: listViewedFiles reads the PR's own `files` connection and keeps
// the VIEWED ones, so a path that left the PR in a force push is already gone
// from the answer. GitHub also drops a file's checkbox when the file changes
// again, so the count can only ever undershoot the total — the clamp is belt
// and braces against rendering "5 of 4".
function filesStep(
  detail: PullRequestDetail,
  viewedFiles: string[],
): ReviewStep {
  const total = detail.changedFiles;
  const viewed = Math.min(viewedFiles.length, total);
  const label = `Inspect ${total} file${total === 1 ? "" : "s"}`;
  // A PR can genuinely have no changed files (a force push that made head
  // match base). There is nothing to inspect, so the step is finished rather
  // than stuck at pending forever.
  if (total === 0) {
    return {
      id: "files",
      label: "Inspect files",
      state: "done",
      detail: "Nothing to inspect",
    };
  }
  if (viewed >= total) {
    return { id: "files", label, state: "done", detail: "All viewed" };
  }
  if (viewed > 0) {
    return {
      id: "files",
      label,
      state: "in_progress",
      detail: `${viewed} of ${total} viewed`,
    };
  }
  return { id: "files", label, state: "pending", detail: "None viewed" };
}

// "Submitted" means this viewer left a verdict — an approval or a request for
// changes. A bare comment isn't the end of a review, and without a token we
// don't know who the viewer is, so the step stays honestly pending.
function submitStep(
  drafts: number,
  reviews: PullRequestReview[],
  viewer: string | undefined,
): ReviewStep {
  const submitted =
    viewer !== undefined &&
    reviews.some(
      (review) =>
        review.author === viewer &&
        (review.state === "approved" || review.state === "changes_requested"),
    );
  if (submitted) {
    return {
      id: "submit",
      label: "Submit review",
      state: "done",
      detail: "Submitted",
    };
  }
  if (drafts > 0) {
    return {
      id: "submit",
      label: "Submit review",
      state: "in_progress",
      detail: `${drafts} draft comment${drafts === 1 ? "" : "s"}`,
    };
  }
  return {
    id: "submit",
    label: "Submit review",
    state: "pending",
    detail: "Pending",
  };
}

export function buildReviewSteps({
  detail,
  analysis,
  viewedFiles,
  draftCount,
  reviews,
  viewer,
}: ReviewProgressInput): ReviewStep[] {
  return [
    summaryStep(detail, analysis),
    filesStep(detail, viewedFiles),
    submitStep(draftCount, reviews, viewer),
  ];
}

const stepMeta: Record<
  StepState,
  { icon: typeof LuCircle; color: string; line: string }
> = {
  done: { icon: LuCircleCheck, color: "green.fg", line: "green.emphasized" },
  in_progress: {
    icon: LuCircleDot,
    color: "colorPalette.fg",
    line: "colorPalette.emphasized",
  },
  pending: { icon: LuCircle, color: "fg.subtle", line: "border" },
};

interface Props {
  detail: PullRequestDetail;
  reviews: PullRequestReview[];
}

// The rail's first section: three steps down a connected line, the way a
// reviewer actually works through a PR — read what it does, look at the files,
// leave a verdict.
export default function ReviewProgress({ detail, reviews }: Props) {
  // Cache-only: getAnalysis never calls the model, so the rail can ask about
  // an analysis without spending credits.
  const analysisQuery = useQuery({
    queryKey: ["analysis", detail.repo, detail.number],
    queryFn: () => window.api.getAnalysis(detail.repo, detail.number),
  });

  const viewedQuery = useQuery({
    queryKey: ["viewedFiles", detail.repo, detail.number],
    queryFn: () => window.api.listViewedFiles(detail.repo, detail.number),
  });

  const draftsQuery = useQuery({
    queryKey: ["draftComments", detail.repo, detail.number],
    queryFn: () => window.api.listDraftComments(detail.repo, detail.number),
  });

  const viewerQuery = useQuery({
    queryKey: ["viewer"],
    queryFn: () => window.api.getViewer(),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const steps = buildReviewSteps({
    detail,
    analysis: analysisQuery.data,
    viewedFiles: viewedQuery.data ?? [],
    draftCount: draftsQuery.data?.length ?? 0,
    reviews,
    viewer: viewerQuery.data ?? undefined,
  });

  return (
    <VStack gap="0" alignItems="stretch">
      {steps.map((step, index) => {
        const meta = stepMeta[step.state];
        const Icon = meta.icon;
        const last = index === steps.length - 1;
        return (
          <HStack key={step.id} gap="3" alignItems="stretch">
            <VStack gap="0" alignItems="center" flexShrink="0">
              <Box color={meta.color} lineHeight="1" mt="0.5">
                <Icon size={16} />
              </Box>
              {!last && <Box flex="1" w="2px" bg={meta.line} my="1" />}
            </VStack>
            <Box pb={last ? "0" : "4"}>
              <Text fontSize="sm" fontWeight="medium" lineHeight="1.3">
                {step.label}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {step.detail}
              </Text>
            </Box>
          </HStack>
        );
      })}
    </VStack>
  );
}
