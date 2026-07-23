import { Badge, Box, Button, HStack, Text, VStack } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LuCheck, LuMessageSquarePlus, LuUndo2, LuX } from "react-icons/lu";
import type {
  DraftReviewComment,
  FindingCategory,
  PullRequestFile,
  ReviewFinding,
} from "../../../shared/types";
import FileDiffCard from "./FileDiffCard";
import Markdown from "./Markdown";
import RiskSeverityBadge from "./RiskSeverityBadge";
import { toaster } from "./ui/toaster";

const categoryMeta: Record<
  FindingCategory,
  { label: string; palette: string }
> = {
  bug: { label: "Bug", palette: "red" },
  blast_radius: { label: "Blast radius", palette: "purple" },
  edge_case: { label: "Edge case", palette: "orange" },
  security: { label: "Security", palette: "red" },
  performance: { label: "Performance", palette: "yellow" },
  maintainability: { label: "Maintainability", palette: "gray" },
  test_gap: { label: "Test gap", palette: "blue" },
};

interface Props {
  finding: ReviewFinding;
  repo: string;
  prNumber: number;
  // Full head SHA the draft comment anchors to.
  commitId: string;
  file: PullRequestFile | undefined;
  // False when the findings run is behind the PR's current commit — the line
  // anchor may be wrong, so drafting is blocked until a re-run.
  canDraft: boolean;
}

export default function FindingCard({
  finding,
  repo,
  prNumber,
  commitId,
  file,
  canDraft,
}: Props) {
  const queryClient = useQueryClient();
  const category = categoryMeta[finding.category];

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: ["findings", repo, prNumber],
    });
  }

  // Accept = draft the suggested comment, then mark the finding accepted so it
  // leaves the open list and won't return on a re-run.
  const accept = useMutation({
    mutationFn: async () => {
      const created = await window.api.addDraftComment(repo, prNumber, {
        commitId,
        path: finding.path,
        side: "RIGHT",
        line: finding.line,
        startLine: null,
        body: finding.suggestion,
      });
      await window.api.setFindingResolution(
        repo,
        prNumber,
        finding.id,
        "accepted",
      );
      return created;
    },
    onSuccess: (created) => {
      queryClient.setQueryData<DraftReviewComment[]>(
        ["draftComments", repo, prNumber],
        (existing) => [...(existing ?? []), created],
      );
      invalidate();
      toaster.create({
        type: "success",
        title: "Added to your review",
        description: `${finding.path}:${finding.line} — draft comment created.`,
      });
    },
    onError: (cause) => {
      toaster.create({
        type: "error",
        title: "Couldn’t add draft comment",
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
    },
  });

  const resolve = useMutation({
    mutationFn: (resolution: "dismissed" | "open") =>
      window.api.setFindingResolution(repo, prNumber, finding.id, resolution),
    onSuccess: invalidate,
    onError: (cause) => {
      toaster.create({
        type: "error",
        title: "Couldn’t update finding",
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
    },
  });

  // Resolved findings collapse to a single restorable row.
  if (finding.resolution) {
    return (
      <HStack
        gap="2"
        px="3"
        py="2"
        borderWidth="1px"
        rounded="md"
        bg="bg.subtle"
        opacity="0.75"
      >
        <Badge colorPalette={category.palette} variant="surface" size="sm">
          {category.label}
        </Badge>
        <Text fontSize="sm" color="fg.muted" truncate flex="1">
          {finding.title}
        </Text>
        <Text fontSize="xs" color="fg.subtle" flexShrink="0">
          {finding.resolution === "accepted" ? "Added to review" : "Dismissed"}
        </Text>
        <Button
          size="2xs"
          variant="ghost"
          color="fg.muted"
          flexShrink="0"
          loading={resolve.isPending}
          onClick={() => resolve.mutate("open")}
        >
          <LuUndo2 /> Restore
        </Button>
      </HStack>
    );
  }

  return (
    <VStack
      alignItems="stretch"
      gap="3"
      borderWidth="1px"
      rounded="lg"
      p="4"
      bg="bg.panel"
    >
      <VStack alignItems="stretch" gap="2">
        <HStack gap="2">
          <RiskSeverityBadge severity={finding.severity} />
          <Badge colorPalette={category.palette} variant="surface">
            {category.label}
          </Badge>
          <Text
            fontSize="xs"
            fontFamily="mono"
            color="fg.subtle"
            ml="auto"
            truncate
            title={`${finding.path}:${finding.line}`}
          >
            {finding.path}:{finding.line}
          </Text>
        </HStack>
        <Text fontSize="md" fontWeight="semibold">
          {finding.title}
        </Text>
      </VStack>

      <Markdown fontSize="sm">{finding.body}</Markdown>

      {file && (
        <FileDiffCard
          id={`finding-diff-${finding.id}`}
          file={file}
          defaultOpen
        />
      )}

      <Box borderLeftWidth="2px" borderColor="border.emphasized" pl="3">
        <Text
          fontSize="2xs"
          fontWeight="semibold"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
          mb="1"
        >
          Suggested comment
        </Text>
        <Markdown fontSize="sm">{finding.suggestion}</Markdown>
      </Box>

      <HStack gap="2">
        <Button
          size="xs"
          colorPalette="green"
          loading={accept.isPending}
          disabled={!canDraft}
          title={
            canDraft
              ? undefined
              : "Re-run findings on the latest commit before drafting."
          }
          onClick={() => accept.mutate()}
        >
          <LuMessageSquarePlus /> Add as draft comment
        </Button>
        <Button
          size="xs"
          variant="ghost"
          color="fg.muted"
          loading={resolve.isPending}
          onClick={() => resolve.mutate("dismissed")}
        >
          <LuX /> Dismiss
        </Button>
        {!canDraft && (
          <HStack gap="1" color="fg.subtle" ml="auto">
            <LuCheck size={12} />
            <Text fontSize="xs">Re-run to draft on the latest commit</Text>
          </HStack>
        )}
      </HStack>
    </VStack>
  );
}
