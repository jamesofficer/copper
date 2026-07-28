import { Box, Button, HStack, Icon, Text } from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LuSparkles, LuTrash2 } from "react-icons/lu";
import type { Explanation } from "../../../shared/types";
import Markdown from "./Markdown";
import { toaster } from "./ui/toaster";

interface Props {
  explanation: Explanation;
  repo: string;
  prNumber: number;
}

// An AI explanation of a selected diff range, anchored under its lines. Styled
// with the accent colour and a sparkle so it never reads as a GitHub comment —
// it's local-only and gets no "post to GitHub" action.
export default function AiExplanationCard({
  explanation,
  repo,
  prNumber,
}: Props) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

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

  const lineLabel =
    explanation.startLine !== null
      ? `lines ${explanation.startLine}–${explanation.line}`
      : `line ${explanation.line}`;

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
          <Button
            size="2xs"
            variant="ghost"
            color="fg.muted"
            ml="auto"
            aria-label="Delete explanation"
            onClick={() => setConfirming(true)}
          >
            <LuTrash2 />
          </Button>
        )}
      </HStack>
      <Box px="3" py="2.5">
        <Markdown fontSize="sm">{explanation.body}</Markdown>
      </Box>
    </Box>
  );
}
