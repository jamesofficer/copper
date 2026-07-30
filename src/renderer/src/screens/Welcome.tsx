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
import { LuFolderGit2, LuFolderPlus, LuGitPullRequest } from "react-icons/lu";
import type { PullRequest, Repository } from "../../../shared/types";
import NewPullRequestDialog from "../components/NewPullRequestDialog";
import OpenPullRequestList from "../components/OpenPullRequestList";
import PullRequestPreview from "../components/PullRequestPreview";
import SetupBanner from "../components/SetupBanner";
import ShowSidebarButton from "../components/ShowSidebarButton";
import { scrollbar } from "../lib/scrollbar";
import { useSidebarCollapsed } from "../lib/sidebarCollapsed";
import { dragRegion, titleBarHeight, trafficLightSpace } from "../lib/titleBar";

interface Props {
  repositories: Repository[] | undefined;
  reposPending: boolean;
  activeRepo: Repository | null;
  onAddRepo(): void;
  onSelect(pr: PullRequest): void;
  preview: PullRequest | null;
  onPreviewChange(pr: PullRequest | null): void;
  onOpenSettings(): void;
}

export default function Welcome({
  repositories,
  reposPending,
  activeRepo: active,
  onAddRepo,
  onSelect,
  preview,
  onPreviewChange,
  onOpenSettings,
}: Props) {
  const queryClient = useQueryClient();
  // With the sidebar hidden its header is gone too, so this bar takes over
  // holding the window's traffic lights clear.
  const collapsed = useSidebarCollapsed();

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

  function openCreatedPullRequest(pr: PullRequest) {
    void queryClient.invalidateQueries({ queryKey: ["pullRequests", pr.repo] });
    void queryClient.invalidateQueries({ queryKey: ["myPullRequests"] });
    void queryClient.invalidateQueries({ queryKey: ["openPrCounts"] });
    onSelect(pr);
  }

  return (
    <>
      <Flex direction="column" flex="1" minW="0">
        <HStack
          flexShrink="0"
          h={titleBarHeight}
          pl={collapsed ? trafficLightSpace : "4"}
          pr="4"
          gap="2"
          borderBottomWidth="1px"
          color="fg.muted"
          css={dragRegion}
        >
          <ShowSidebarButton />
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
            <SetupBanner onOpenSettings={onOpenSettings} />

            {!reposPending && (!repositories || repositories.length === 0) ? (
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
                  <Button onClick={onAddRepo}>
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
                      onSelect={onPreviewChange}
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
          onClose={() => onPreviewChange(null)}
        />
      )}
    </>
  );
}
