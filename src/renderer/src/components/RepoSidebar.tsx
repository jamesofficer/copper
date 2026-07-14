import {
  Box,
  Button,
  Flex,
  Heading,
  Spinner,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuFolderPlus, LuTrash2 } from "react-icons/lu";
import type { Repository } from "../../../shared/types";
import { scrollbar } from "../lib/scrollbar";

interface Props {
  repositories: Repository[] | undefined;
  isPending: boolean;
  activePath: string | null;
  onSelect(path: string): void;
  onAdd(): void;
  onRemove(): void;
}

export default function RepoSidebar({
  repositories,
  isPending,
  activePath,
  onSelect,
  onAdd,
  onRemove,
}: Props) {
  return (
    <Flex
      direction="column"
      w="64"
      flexShrink="0"
      minH="0"
      borderRightWidth="1px"
    >
      <Heading
        size="xs"
        color="fg.muted"
        textTransform="uppercase"
        letterSpacing="wider"
        px="4"
        py="3"
        flexShrink="0"
      >
        Repositories
      </Heading>

      <Stack flex="1" minH="0" overflowY="auto" px="2" pb="2" css={scrollbar}>
        {isPending ? (
          <Spinner size="sm" color="fg.muted" alignSelf="center" mt="4" />
        ) : !repositories || repositories.length === 0 ? (
          <Text fontSize="sm" color="fg.muted" px="2">
            No repositories yet. Add a local git repository to get started.
          </Text>
        ) : (
          repositories.map((repo) => {
            const selected = repo.path === activePath;
            return (
              <Box
                key={repo.path}
                as="button"
                onClick={() => onSelect(repo.path)}
                textAlign="left"
                px="3"
                py="2"
                rounded="md"
                cursor="pointer"
                flexShrink="0"
                bg={selected ? "bg.emphasized" : undefined}
                _hover={selected ? undefined : { bg: "bg.subtle" }}
              >
                <Text fontSize="sm" fontFamily="mono" truncate>
                  {repo.slug?.split("/")[1] ?? repo.name}
                </Text>
                <Text fontSize="xs" color="fg.muted" truncate>
                  {repo.path}
                </Text>
              </Box>
            );
          })
        )}
      </Stack>

      <VStack
        p="3"
        borderTopWidth="1px"
        gap="2"
        alignItems="stretch"
        flexShrink="0"
      >
        <Button size="sm" variant="outline" onClick={onAdd}>
          <LuFolderPlus /> Add repository
        </Button>
        <Button
          size="sm"
          variant="ghost"
          colorPalette="red"
          disabled={!activePath}
          onClick={onRemove}
        >
          <LuTrash2 /> Remove repository
        </Button>
      </VStack>
    </Flex>
  );
}
