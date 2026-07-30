import {
  Alert,
  Box,
  Button,
  EmptyState,
  Flex,
  Heading,
  HStack,
  Spinner,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LuFolderGit2, LuFolderPlus, LuGitPullRequest } from "react-icons/lu";
import type { PullRequest, Repository } from "../../../shared/types";
import HomeSidebar from "../components/HomeSidebar";
import NewPullRequestDialog from "../components/NewPullRequestDialog";
import OpenPullRequestList from "../components/OpenPullRequestList";
import PullRequestPreview from "../components/PullRequestPreview";
import SettingsDialog from "../components/SettingsDialog";
import SetupBanner from "../components/SetupBanner";
import { toaster } from "../components/ui/toaster";
import {
  clearRecentPullRequests,
  listRecentPullRequests,
} from "../lib/recentPrs";
import { scrollbar } from "../lib/scrollbar";
import { dragRegion, titleBarHeight } from "../lib/titleBar";

interface Props {
  onSelect(pr: PullRequest): void;
  activePath: string | null;
  onActivePathChange(path: string | null): void;
}

export default function Welcome({
  onSelect,
  activePath,
  onActivePathChange,
}: Props) {
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recent, setRecent] = useState(() => listRecentPullRequests());
  // Clicking a PR anywhere on this screen previews its Overview in a right
  // panel; the panel's "View PR" button opens the full review screen.
  const [preview, setPreview] = useState<PullRequest | null>(null);

  function clearRecent() {
    clearRecentPullRequests();
    setRecent([]);
  }

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
      // Both sidebar PR sections and the repo rows' PR counts are scoped to
      // registered repos in the main process, so the registry changing means
      // new results.
      void queryClient.invalidateQueries({ queryKey: ["reviewRequests"] });
      void queryClient.invalidateQueries({ queryKey: ["myPullRequests"] });
      void queryClient.invalidateQueries({ queryKey: ["openPrCounts"] });
      onActivePathChange(added.path);
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

  function reorderRepositories(ordered: Repository[]) {
    // Optimistic: show the new order immediately, then persist it. The main
    // process returns the saved list, which wins in case they disagree.
    queryClient.setQueryData(["repositories"], ordered);
    window.api
      .reorderRepositories(ordered.map((repo) => repo.path))
      .then((saved) => queryClient.setQueryData(["repositories"], saved))
      .catch(() =>
        queryClient.invalidateQueries({ queryKey: ["repositories"] }),
      );
  }

  function openCreatedPullRequest(pr: PullRequest) {
    void queryClient.invalidateQueries({ queryKey: ["pullRequests", pr.repo] });
    void queryClient.invalidateQueries({ queryKey: ["myPullRequests"] });
    void queryClient.invalidateQueries({ queryKey: ["openPrCounts"] });
    onSelect(pr);
  }

  async function removeRepository(path: string) {
    const remaining = await window.api.removeRepository(path);
    queryClient.setQueryData(["repositories"], remaining);
    void queryClient.invalidateQueries({ queryKey: ["reviewRequests"] });
    void queryClient.invalidateQueries({ queryKey: ["myPullRequests"] });
    void queryClient.invalidateQueries({ queryKey: ["openPrCounts"] });
    if (activePath === path || !activePath) {
      onActivePathChange(remaining[0]?.path ?? null);
    }
  }

  return (
    <Flex h="100vh" minH="0">
      <HomeSidebar
        repositories={repositories}
        reposPending={reposQuery.isPending}
        activePath={active?.path ?? null}
        onSelectRepo={onActivePathChange}
        onAddRepo={() => void addRepository()}
        onRemoveRepo={(path) => void removeRepository(path)}
        onReorderRepos={reorderRepositories}
        recent={recent}
        onClearRecent={clearRecent}
        onSelectPullRequest={setPreview}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <Flex direction="column" flex="1" minW="0">
        <HStack
          flexShrink="0"
          h={titleBarHeight}
          px="4"
          gap="2"
          borderBottomWidth="1px"
          color="fg.muted"
          css={dragRegion}
        >
          <LuGitPullRequest />
          <Heading size="sm">Open pull requests</Heading>
          {active?.slug && (
            <Box ml="auto">
              <NewPullRequestDialog
                key={active.slug}
                repo={active.slug}
                onCreated={openCreatedPullRequest}
              />
            </Box>
          )}
        </HStack>

        <Box flex="1" minH="0">
          <Stack
            h="full"
            minH="0"
            overflowY="auto"
            gap="3"
            px="4"
            py="4"
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
                    <OpenPullRequestList
                      key={active.slug}
                      prs={prs}
                      preview={preview}
                      onSelect={setPreview}
                      onOpen={onSelect}
                    />
                  ))}
              </>
            )}
          </Stack>
        </Box>
      </Flex>

      {preview && (
        <PullRequestPreview
          pr={preview}
          onView={onSelect}
          onClose={() => setPreview(null)}
        />
      )}

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Flex>
  );
}
