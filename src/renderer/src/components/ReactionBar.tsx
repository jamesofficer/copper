import {
  Button,
  HStack,
  IconButton,
  Menu,
  Portal,
  SimpleGrid,
  Text,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LuSmilePlus } from "react-icons/lu";
import {
  type PullRequestReactions,
  type ReactionContent,
  reactionContents,
} from "../../../shared/types";
import {
  applyReactionToMap,
  orderReactions,
  reactionEmoji,
  reactionLabel,
} from "../lib/reactions";
import { toaster } from "./ui/toaster";

interface Props {
  repo: string;
  prNumber: number;
  // The comment's REST id, which the reaction map is keyed by.
  commentId: number;
  // The comment's GraphQL node id, which the reaction mutation needs.
  commentNodeId: string;
}

// Emoji reactions on one comment, GitHub-style: a chip per emoji used, filled
// when the signed-in user is one of the reactors, plus a picker for the rest.
// All comments of a PR share a single reactions query, so this adds no fetch
// per comment.
export default function ReactionBar({
  repo,
  prNumber,
  commentId,
  commentNodeId,
}: Props) {
  const queryClient = useQueryClient();
  const queryKey = ["reactions", repo, prNumber];

  const reactionsQuery = useQuery({
    queryKey,
    queryFn: () => window.api.listReactions(repo, prNumber),
  });
  const groups = orderReactions(reactionsQuery.data?.[commentId] ?? []);

  const toggle = useMutation({
    mutationFn: (variables: { content: ReactionContent; reacted: boolean }) =>
      window.api.setReaction(
        commentNodeId,
        variables.content,
        variables.reacted,
      ),
    // Show the click immediately; the refetch below confirms it.
    onMutate: ({ content, reacted }) => {
      const previous = queryClient.getQueryData<PullRequestReactions>(queryKey);
      if (previous) {
        queryClient.setQueryData<PullRequestReactions>(
          queryKey,
          applyReactionToMap(previous, commentId, content, reacted),
        );
      }
      return { previous };
    },
    onError: (cause, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toaster.create({
        type: "error",
        title: "Couldn’t react",
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  function react(content: ReactionContent) {
    const reacted =
      groups.find((group) => group.content === content)?.viewerHasReacted ??
      false;
    toggle.mutate({ content, reacted: !reacted });
  }

  return (
    <HStack gap="1" mt="2" flexWrap="wrap">
      {groups.map((group) => (
        <Button
          key={group.content}
          size="2xs"
          variant={group.viewerHasReacted ? "subtle" : "outline"}
          colorPalette={group.viewerHasReacted ? undefined : "gray"}
          aria-pressed={group.viewerHasReacted}
          title={reactionLabel[group.content]}
          onClick={() => react(group.content)}
        >
          <Text as="span">{reactionEmoji[group.content]}</Text>
          <Text as="span" fontFamily="mono">
            {group.count}
          </Text>
        </Button>
      ))}

      <Menu.Root
        positioning={{ placement: "bottom-start" }}
        onSelect={({ value }) => react(value as ReactionContent)}
      >
        <Menu.Trigger asChild>
          <IconButton
            aria-label="Add reaction"
            title="Add reaction"
            size="2xs"
            variant="ghost"
            color="fg.muted"
          >
            <LuSmilePlus />
          </IconButton>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="0" p="1">
              <SimpleGrid columns={4} gap="0.5">
                {reactionContents.map((content) => (
                  <Menu.Item
                    key={content}
                    value={content}
                    title={reactionLabel[content]}
                    justifyContent="center"
                    fontSize="md"
                    px="1.5"
                  >
                    {reactionEmoji[content]}
                  </Menu.Item>
                ))}
              </SimpleGrid>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </HStack>
  );
}
