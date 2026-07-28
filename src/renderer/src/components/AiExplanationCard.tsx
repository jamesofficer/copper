import { Badge, Box, Button, HStack, Icon, Text } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LuRefreshCw, LuSparkles, LuTrash2 } from "react-icons/lu";
import type { Explanation } from "../../../shared/types";
import type { ResolvedExplanation } from "../lib/explanationStatus";
import Markdown from "./Markdown";
import { toaster } from "./ui/toaster";

interface Props {
  resolved: ResolvedExplanation;
  repo: string;
  prNumber: number;
}

// An AI explanation of a selected diff range, anchored under its lines. Styled
// with the accent colour and a sparkle so it never reads as a GitHub comment —
// it's local-only and gets no "post to GitHub" action.
export default function AiExplanationCard({ resolved, repo, prNumber }: Props) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const { explanation, stale, line, startLine, currentCode } = resolved;
  const explanationsKey = ["explanations", repo, prNumber];

  const remove = useMutation({
    mutationFn: () =>
      window.api.deleteExplanation(repo, prNumber, explanation.id),
    onSuccess: () => {
      queryClient.setQueryData<Explanation[]>(explanationsKey, (existing) =>
        (existing ?? []).filter((entry) => entry.id !== explanation.id),
      );
    },
    onError: (cause) => {
      setConfirming(false);
      toaster.create({
        type: "error",
        title: "Couldn’t delete explanation",
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
    },
  });

  // Re-runs the agent over whatever is at these lines now, then drops the old
  // answer. Explaining first means a failure leaves the stale card in place
  // rather than losing it.
  const reexplain = useMutation({
    mutationFn: async () => {
      const created = await window.api.explainSelection(repo, prNumber, {
        path: explanation.path,
        side: explanation.side,
        line,
        startLine,
        code: currentCode,
      });
      await window.api.deleteExplanation(repo, prNumber, explanation.id);
      return created;
    },
    onSuccess: (created) => {
      queryClient.setQueryData<Explanation[]>(explanationsKey, (existing) => [
        ...(existing ?? []).filter((entry) => entry.id !== explanation.id),
        created,
      ]);
    },
    onError: (cause) => {
      toaster.create({
        type: "error",
        title: "Couldn’t re-explain these lines",
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
    },
  });

  const lineLabel =
    startLine !== null ? `lines ${startLine}–${line}` : `line ${line}`;

  return (
    <Box
      borderWidth="1px"
      borderColor="colorPalette.emphasized"
      rounded="lg"
      overflow="hidden"
      bg="bg.panel"
    >
      <HStack
        gap="2"
        px="3"
        py="2"
        bg="colorPalette.subtle"
        borderBottomWidth="1px"
        borderColor="colorPalette.emphasized"
      >
        <Icon color="colorPalette.fg" flexShrink="0">
          <LuSparkles />
        </Icon>
        <Text fontSize="xs" fontWeight="semibold" color="colorPalette.fg">
          AI explanation
        </Text>
        <Text fontSize="xs" color="fg.muted">
          {lineLabel}
          {explanation.side === "LEFT" ? " · old version" : ""}
        </Text>
        {stale && (
          <Badge colorPalette="orange" variant="surface" size="sm">
            Explains an earlier version
          </Badge>
        )}
        {confirming ? (
          <HStack gap="1" ml="auto">
            <Button
              size="2xs"
              colorPalette="red"
              loading={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Delete
            </Button>
            <Button
              size="2xs"
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </HStack>
        ) : (
          <HStack gap="1" ml="auto">
            {stale && (
              <Button
                size="2xs"
                variant="ghost"
                color="fg.muted"
                loading={reexplain.isPending}
                loadingText="Re-explaining…"
                disabled={currentCode.length === 0}
                title={
                  currentCode.length === 0
                    ? "These lines are no longer in the diff."
                    : "Explain these lines as they are now"
                }
                onClick={() => reexplain.mutate()}
              >
                <LuRefreshCw /> Re-explain
              </Button>
            )}
            <Button
              size="2xs"
              variant="ghost"
              color="fg.muted"
              aria-label="Delete explanation"
              disabled={reexplain.isPending}
              onClick={() => setConfirming(true)}
            >
              <LuTrash2 />
            </Button>
          </HStack>
        )}
      </HStack>
      {stale && (
        <HStack
          gap="2"
          px="3"
          py="2"
          bg="orange.subtle"
          borderBottomWidth="1px"
          borderColor="orange.emphasized"
        >
          <Text fontSize="xs" color="fg.muted">
            These lines changed after this was written, so it may no longer be
            accurate.
          </Text>
        </HStack>
      )}
      <Box px="3" py="2.5">
        <Markdown fontSize="sm">{explanation.body}</Markdown>
      </Box>
    </Box>
  );
}
