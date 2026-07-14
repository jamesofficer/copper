import {
  Alert,
  Button,
  EmptyState,
  Flex,
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
  LuHistory,
  LuSettings,
  LuTrash2,
} from "react-icons/lu";
import type { PullRequest, Repository } from "../../../shared/types";
import PullRequestCard from "../components/PullRequestCard";
import SettingsDialog from "../components/SettingsDialog";
import SetupBanner from "../components/SetupBanner";
import { toaster } from "../components/ui/toaster";
import { listRecentPullRequests } from "../lib/recentPrs";
import { scrollbar } from "../lib/scrollbar";

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

  const recent = listRecentPullRequests();

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
    <Flex h="100vh">
      <Flex direction="column" flex="1" minW="0" borderRightWidth="1px">
        <VStack
          alignItems="stretch"
          gap="5"
          px="6"
          pt="6"
          pb="5"
          flexShrink="0"
          w="full"
          maxW="2xl"
        >
          <HStack gap="2.5" color="colorPalette.fg">
            <Icon size="md">
              <LuGitPullRequestArrow />
            </Icon>
            <Heading size="lg" letterSpacing="tight">
              Reviewr
            </Heading>
          </HStack>

          <SetupBanner onOpenSettings={() => setSettingsOpen(true)} />

          {reposQuery.isPending ? (
            <Spinner color="fg.muted" alignSelf="center" />
          ) : !repositories || repositories.length === 0 ? (
            <EmptyState.Root
              borderWidth="1px"
              borderStyle="dashed"
              rounded="xl"
            >
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
            <>
              <Menu.Root
                onSelect={(details) => handleMenuSelect(details.value)}
              >
                <Menu.Trigger asChild>
                  <Button
                    variant="outline"
                    size="lg"
                    w="full"
                    justifyContent="space-between"
                    px="4"
                  >
                    <HStack gap="3" minW="0">
                      <Icon color="fg.muted">
                        <LuFolderGit2 />
                      </Icon>
                      <Text fontFamily="mono" fontSize="sm" truncate>
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
                  This repository has no GitHub remote, so pull requests can’t
                  be loaded.
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

              {active?.slug && !prsError && (
                <Text
                  fontSize="xs"
                  color="fg.muted"
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  Open pull requests
                </Text>
              )}
            </>
          )}
        </VStack>

        {active?.slug && !prsError && (
          <Stack
            flex="1"
            minH="0"
            overflowY="auto"
            gap="3"
            px="6"
            pb="6"
            w="full"
            maxW="2xl"
            css={scrollbar}
          >
            {prsQuery.isPending || !prs ? (
              <HStack color="fg.muted" py="8">
                <Spinner size="sm" />
                <Text fontSize="sm">Loading open pull requests…</Text>
              </HStack>
            ) : prs.length === 0 ? (
              <Text fontSize="sm" color="fg.muted" py="8">
                No open pull requests. Nice and quiet.
              </Text>
            ) : (
              prs.map((pr) => (
                <PullRequestCard
                  key={`${pr.repo}#${pr.number}`}
                  pr={pr}
                  onSelect={onSelect}
                />
              ))
            )}
          </Stack>
        )}
      </Flex>

      <Flex direction="column" w="26rem" flexShrink="0" minH="0">
        <HStack
          justifyContent="space-between"
          px="4"
          py="3"
          flexShrink="0"
          gap="2"
        >
          <HStack gap="2" color="fg.muted">
            <LuHistory size={13} />
            <Heading
              size="xs"
              textTransform="uppercase"
              letterSpacing="wider"
              color="fg.muted"
            >
              Recently viewed
            </Heading>
          </HStack>
          <IconButton
            aria-label="Settings"
            variant="ghost"
            size="sm"
            color="fg.muted"
            onClick={() => setSettingsOpen(true)}
          >
            <LuSettings />
          </IconButton>
        </HStack>

        <Stack
          flex="1"
          minH="0"
          overflowY="auto"
          gap="3"
          px="4"
          pb="4"
          css={scrollbar}
        >
          {recent.length === 0 ? (
            <Text fontSize="sm" color="fg.muted">
              Pull requests you open will show up here, so you can jump back to
              them quickly.
            </Text>
          ) : (
            recent.map((pr) => (
              <PullRequestCard
                key={`${pr.repo}#${pr.number}`}
                pr={pr}
                onSelect={onSelect}
                showRepo
                viewedAt={pr.viewedAt}
              />
            ))
          )}
        </Stack>
      </Flex>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Flex>
  );
}
