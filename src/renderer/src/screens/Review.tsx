import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import {
  LuArrowLeft,
  LuExternalLink,
  LuFileDiff,
  LuInfo,
  LuSparkles,
} from "react-icons/lu";
import type { PullRequest } from "../../../shared/types";
import ChangesView from "../components/ChangesView";
import DiffViewModeSelect from "../components/DiffViewModeSelect";
import PullRequestOverview from "../components/PullRequestOverview";
import ReviewPanel from "../components/ReviewPanel";
import SubmitReviewDialog from "../components/SubmitReviewDialog";

interface Props {
  pr: PullRequest;
  onBack(): void;
}

export default function Review({ pr, onBack }: Props) {
  return (
    <Flex direction="column" h="100vh">
      <HStack
        gap="3"
        px="4"
        py="3"
        borderBottomWidth="1px"
        flexShrink="0"
        align="center"
      >
        <Button variant="outline" size="xs" onClick={onBack}>
          <LuArrowLeft /> Back
        </Button>
        <Heading size="lg" truncate>
          {pr.title}
        </Heading>
        <Text fontFamily="mono" fontSize="sm" color="fg.muted" flex="1">
          {pr.repo}#{pr.number}
        </Text>
        <Button asChild variant="outline" size="xs">
          <a href={pr.url} target="_blank" rel="noreferrer">
            <LuExternalLink /> Open in GitHub
          </a>
        </Button>
        <SubmitReviewDialog pr={pr} />
      </HStack>

      <Tabs.Root
        defaultValue="overview"
        display="flex"
        flexDirection="column"
        flex="1"
        minH="0"
      >
        <Tabs.List flexShrink="0" px="4" alignItems="center">
          <Tabs.Trigger value="overview">
            <LuInfo /> Overview
          </Tabs.Trigger>
          <Tabs.Trigger value="changes">
            <LuFileDiff /> Changes ({pr.changedFiles})
          </Tabs.Trigger>
          <Tabs.Trigger value="review">
            <LuSparkles /> Review
          </Tabs.Trigger>
          <Box ml="auto">
            <DiffViewModeSelect />
          </Box>
        </Tabs.List>

        <Tabs.Content value="overview" flex="1" minH="0" p="0">
          <PullRequestOverview pr={pr} />
        </Tabs.Content>
        <Tabs.Content value="changes" flex="1" minH="0" p="0">
          <ChangesView pr={pr} />
        </Tabs.Content>
        <Tabs.Content value="review" flex="1" minH="0" p="0">
          <ReviewPanel pr={pr} />
        </Tabs.Content>
      </Tabs.Root>
    </Flex>
  );
}
