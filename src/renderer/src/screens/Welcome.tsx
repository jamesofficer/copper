import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  EmptyState,
  Heading,
  HStack,
  Icon,
  IconButton,
  Menu,
  Portal,
  Spinner,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LuChevronsUpDown,
  LuFolderGit2,
  LuFolderPlus,
  LuGitPullRequestArrow,
  LuSettings,
  LuTrash2,
} from "react-icons/lu";
import type { PullRequest, Repository } from "../../../shared/types";
import SettingsDialog from "../components/SettingsDialog";
import SetupBanner from "../components/SetupBanner";
import { toaster } from "../components/ui/toaster";

interface Props {
  onSelect(pr: PullRequest): void;
}

export default function Welcome({ onSelect }: Props) {
  const queryClient = useQueryClient();
  const [activePath, setActivePath] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const reposQuery = useQuery({
    queryKey: ["repositories"],
    queryFn: () => window.api.listRepositories(),
  });
  const repositories = reposQuery.data;
  const active =
    repositories?.find((repo) => repo.path === activePath) ??
    repositories?.[0] ??
    null;

  const prsQuery = useQuery({
    queryKey: ["pullRequests", active?.slug],
    queryFn: () => window.api.listPullRequests(active?.slug ?? ""),
    enabled: Boolean(active?.slug),
  });
  const prs = prsQuery.data;
  const prsError = prsQuery.error
    ? prsQuery.error instanceof Error
      ? prsQuery.error.message
      : "Couldn't load pull requests."
    : null;

  async function addRepository() {
    try {
      const added = await window.api.addRepository();
      if (!added) return;
      queryClient.setQueryData<Repository[]>(["repositories"], (prev) => [
        added,
        ...(prev ?? []).filter((repo) => repo.path !== added.path),
      ]);
      setActivePath(added.path);
    } catch (cause) {
      toaster.create({
        type: "error",
        title: "Couldn’t add repository",
        description:
          cause instanceof Error
            ? cause.message.replace(/^.*Error: /, "")
            : String(cause),
        closable: true,
      });
    }
  }

  async function removeActive() {
    if (!active) return;
    const remaining = await window.api.removeRepository(active.path);
    queryClient.setQueryData(["repositories"], remaining);
    setActivePath(remaining[0]?.path ?? null);
  }

  function handleMenuSelect(value: string) {
    if (value === "add") {
      void addRepository();
    } else if (value === "remove") {
      void removeActive();
    } else {
      setActivePath(value);
    }
  }

  return (
    <Center minH="100vh" px="6" position="relative">
      <IconButton
        aria-label="Settings"
        variant="ghost"
        color="fg.muted"
        position="absolute"
        top="4"
        right="4"
        onClick={() => setSettingsOpen(true)}
      >
        <LuSettings />
      </IconButton>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <VStack gap="10" w="full" maxW="xl" py="16">
        <VStack gap="2">
          <HStack gap="2.5" color="colorPalette.fg">
            <Icon size="lg">
              <LuGitPullRequestArrow />
            </Icon>
            <Heading size="2xl" letterSpacing="tight">
              PR Reviewer
            </Heading>
          </HStack>
          <Text color="fg.muted" textAlign="center">
            Pick a repository to see its open pull requests.
          </Text>
        </VStack>

        <SetupBanner onOpenSettings={() => setSettingsOpen(true)} />

        {reposQuery.isPending ? (
          <Spinner color="fg.muted" />
        ) : !repositories || repositories.length === 0 ? (
          <EmptyState.Root borderWidth="1px" borderStyle="dashed" rounded="xl">
            <EmptyState.Content>
              <EmptyState.Indicator>
                <LuFolderGit2 />
              </EmptyState.Indicator>
              <VStack textAlign="center">
                <EmptyState.Title>No repositories yet</EmptyState.Title>
                <EmptyState.Description>
                  Add a local git repository to start reviewing its pull
                  requests.
                </EmptyState.Description>
              </VStack>
              <Button onClick={addRepository}>
                <LuFolderPlus /> Add repository
              </Button>
            </EmptyState.Content>
          </EmptyState.Root>
        ) : (
          <VStack gap="6" w="full">
            <Menu.Root onSelect={(details) => handleMenuSelect(details.value)}>
              <Menu.Trigger asChild>
                <Button
                  variant="outline"
                  size="xl"
                  w="full"
                  justifyContent="space-between"
                  px="5"
                >
                  <HStack gap="3" minW="0">
                    <Icon color="fg.muted">
                      <LuFolderGit2 />
                    </Icon>
                    <Text fontFamily="mono" fontSize="md" truncate>
                      {active
                        ? (active.slug ?? active.name)
                        : "Choose a repository"}
                    </Text>
                  </HStack>
                  <Icon color="fg.muted">
                    <LuChevronsUpDown />
                  </Icon>
                </Button>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content minW="var(--reference-width)">
                    {repositories.map((repo) => (
                      <Menu.Item key={repo.path} value={repo.path}>
                        <VStack gap="0" alignItems="flex-start">
                          <Text fontFamily="mono">
                            {repo.slug ?? repo.name}
                          </Text>
                          <Text fontSize="xs" color="fg.muted">
                            {repo.path}
                          </Text>
                        </VStack>
                      </Menu.Item>
                    ))}
                    <Menu.Separator />
                    <Menu.Item value="add">
                      <LuFolderPlus /> Add local repository…
                    </Menu.Item>
                    {active && (
                      <Menu.Item
                        value="remove"
                        color="fg.error"
                        _hover={{ bg: "bg.error", color: "fg.error" }}
                      >
                        <LuTrash2 /> Remove {active.name} from list
                      </Menu.Item>
                    )}
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>

            {active && !active.slug && (
              <Text fontSize="sm" color="fg.muted">
                This repository has no GitHub remote, so pull requests can’t be
                loaded.
              </Text>
            )}

            {prsError && (
              <Alert.Root status="error" rounded="lg" w="full">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Couldn’t load pull requests</Alert.Title>
                  <Alert.Description>{prsError}</Alert.Description>
                </Alert.Content>
              </Alert.Root>
            )}

            {active?.slug &&
              !prsError &&
              (prsQuery.isPending || !prs ? (
                <HStack color="fg.muted" py="8">
                  <Spinner size="sm" />
                  <Text fontSize="sm">Loading open pull requests…</Text>
                </HStack>
              ) : prs.length === 0 ? (
                <Text fontSize="sm" color="fg.muted" py="8">
                  No open pull requests. Nice and quiet.
                </Text>
              ) : (
                <Stack gap="3" w="full">
                  <Text
                    fontSize="xs"
                    color="fg.muted"
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    Open pull requests
                  </Text>
                  <Stack
                    gap="3"
                    maxH="22rem"
                    overflowY="auto"
                    borderWidth="1px"
                    rounded="xl"
                    bg="transparent"
                    p="3"
                    css={{
                      "&::-webkit-scrollbar": { width: "16px" },
                      "&::-webkit-scrollbar-track": {
                        background: "transparent",
                      },
                      "&::-webkit-scrollbar-thumb": {
                        background: "var(--chakra-colors-border-emphasized)",
                        borderRadius: "9999px",
                        border: "5px solid transparent",
                        backgroundClip: "padding-box",
                      },
                      "&::-webkit-scrollbar-thumb:hover": {
                        background: "var(--chakra-colors-border-muted)",
                        backgroundClip: "padding-box",
                      },
                    }}
                  >
                    {prs.map((pr) => (
                      <Box
                        key={`${pr.repo}#${pr.number}`}
                        as="button"
                        onClick={() => onSelect(pr)}
                        textAlign="left"
                        borderWidth="1px"
                        rounded="lg"
                        px="5"
                        py="4"
                        cursor="pointer"
                        transition="backgrounds"
                        _hover={{
                          bg: "bg.subtle",
                          borderColor: "colorPalette.muted",
                        }}
                      >
                        <HStack
                          justifyContent="space-between"
                          gap="4"
                          alignItems="flex-start"
                        >
                          <VStack gap="1" alignItems="flex-start" minW="0">
                            <Text fontWeight="semibold" wordBreak="break-word">
                              {pr.title}
                            </Text>
                            <HStack
                              fontFamily="mono"
                              fontSize="xs"
                              color="fg.muted"
                              gap="3"
                            >
                              <Text>#{pr.number}</Text>
                              <Text>{pr.author}</Text>
                              <Text>{pr.changedFiles} files</Text>
                            </HStack>
                          </VStack>
                          <HStack
                            fontFamily="mono"
                            fontSize="xs"
                            gap="2"
                            flexShrink="0"
                          >
                            <Badge colorPalette="green" variant="surface">
                              +{pr.additions}
                            </Badge>
                            <Badge colorPalette="red" variant="surface">
                              −{pr.deletions}
                            </Badge>
                          </HStack>
                        </HStack>
                      </Box>
                    ))}
                  </Stack>
                </Stack>
              ))}
          </VStack>
        )}
      </VStack>
    </Center>
  );
}
