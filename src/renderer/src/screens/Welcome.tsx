import {
  Alert,
  Button,
  EmptyState,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Spinner,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LuFolderGit2,
  LuFolderPlus,
  LuGitPullRequestArrow,
  LuSettings,
} from "react-icons/lu";
import type { PullRequest, Repository } from "../../../shared/types";
import PullRequestCard from "../components/PullRequestCard";
import RecentPanel from "../components/RecentPanel";
import RepoSidebar from "../components/RepoSidebar";
import SettingsDialog from "../components/SettingsDialog";
import SetupBanner from "../components/SetupBanner";
import { toaster } from "../components/ui/toaster";
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

  return (
    <Flex direction="column" h="100vh">
      <HStack
        justifyContent="space-between"
        px="4"
        py="2"
        borderBottomWidth="1px"
        flexShrink="0"
      >
        <HStack gap="2.5" color="colorPalette.fg">
          <Icon size="sm">
            <LuGitPullRequestArrow />
          </Icon>
          <Heading size="md" letterSpacing="tight">
            PR Reviewer
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

      <Flex flex="1" minH="0">
        <RepoSidebar
          repositories={repositories}
          isPending={reposQuery.isPending}
          activePath={active?.path ?? null}
          onSelect={setActivePath}
          onAdd={() => void addRepository()}
          onRemove={() => void removeActive()}
        />

        <Flex direction="column" flex="1" minW="0">
          <Heading
            size="xs"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="wider"
            px="4"
            py="3"
            flexShrink="0"
          >
            Open pull requests
          </Heading>

          <Stack
            flex="1"
            minH="0"
            overflowY="auto"
            gap="3"
            px="4"
            pb="4"
            css={scrollbar}
          >
            <SetupBanner onOpenSettings={() => setSettingsOpen(true)} />

            {!reposQuery.isPending &&
            (!repositories || repositories.length === 0) ? (
              <EmptyState.Root
                borderWidth="1px"
                borderStyle="dashed"
                rounded="xl"
                maxW="2xl"
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
                {active && !active.slug && (
                  <Text fontSize="sm" color="fg.muted">
                    This repository has no GitHub remote, so pull requests can’t
                    be loaded.
                  </Text>
                )}

                {prsError && (
                  <Alert.Root status="error" rounded="lg" maxW="2xl">
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
                    <HStack color="fg.muted" py="4">
                      <Spinner size="sm" />
                      <Text fontSize="sm">Loading open pull requests…</Text>
                    </HStack>
                  ) : prs.length === 0 ? (
                    <Text fontSize="sm" color="fg.muted" py="4">
                      No open pull requests. Nice and quiet.
                    </Text>
                  ) : (
                    prs.map((pr) => (
                      <PullRequestCard
                        key={`${pr.repo}#${pr.number}`}
                        pr={pr}
                        onSelect={onSelect}
                        maxW="2xl"
                      />
                    ))
                  ))}
              </>
            )}
          </Stack>
        </Flex>

        <RecentPanel onSelect={onSelect} />
      </Flex>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Flex>
  );
}
