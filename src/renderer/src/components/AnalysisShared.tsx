import {
  Badge,
  Button,
  Group,
  Heading,
  HStack,
  IconButton,
  Menu,
  Portal,
  Spinner,
  Text,
  VStack,
  Wrap,
} from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuChevronDown, LuMessageCircleQuestion } from "react-icons/lu";
import type { AnalysisClaim, PullRequestFile } from "../../../shared/types";
import {
  type AskContext,
  claimAskContext,
  suggestedQuestions,
} from "../lib/askContext";
import FileDiffCard from "./FileDiffCard";

// Small pieces shared between the analysis detail panes (summary, claims,
// groups) and the issue pane.

export type FileMap = Map<string, PullRequestFile>;

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <Heading
      size="xs"
      color="fg.muted"
      textTransform="uppercase"
      letterSpacing="wider"
    >
      {children}
    </Heading>
  );
}

export function LoadingDiffs() {
  return (
    <HStack color="fg.muted">
      <Spinner size="sm" />
      <Text fontSize="sm">Loading diffs…</Text>
    </HStack>
  );
}

export function fileName(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

export function scrollToFile(path: string): void {
  document
    .getElementById(`diff-${path}`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// A claim's anchors as clickable file:line chips that jump to the file's
// embedded diff below.
export function AnchorChips({ claim }: { claim: AnalysisClaim }) {
  if (claim.anchors.length === 0) return null;
  return (
    <Wrap gap="1.5">
      {claim.anchors.map((anchor) => (
        <Badge
          key={`${anchor.path}:${anchor.line}`}
          as="button"
          onClick={() => scrollToFile(anchor.path)}
          fontFamily="mono"
          variant="surface"
          cursor="pointer"
          _hover={{ bg: "bg.emphasized" }}
          title={anchor.path}
        >
          {fileName(anchor.path)}
          {anchor.line === null ? "" : `:${anchor.line}`}
        </Badge>
      ))}
    </Wrap>
  );
}

export function DiffCards({
  paths,
  fileByPath,
  defaultOpen = true,
}: {
  paths: string[];
  fileByPath: FileMap;
  defaultOpen?: boolean;
}) {
  return (
    <VStack alignItems="stretch" gap="2">
      {paths.map((path) => {
        const file = fileByPath.get(path);
        if (!file) return null;
        return (
          <FileDiffCard
            key={path}
            id={`diff-${path}`}
            file={file}
            defaultOpen={defaultOpen}
          />
        );
      })}
    </VStack>
  );
}

// "Ask about this" with a menu of suggested questions, wired to the chat.
export function AskAboutButton({
  label,
  claim,
  onAskAbout,
}: {
  label: AskContext["label"];
  claim: AnalysisClaim;
  onAskAbout(context: AskContext, question?: string): void;
}) {
  return (
    <Group attached>
      <Button
        size="xs"
        variant="outline"
        onClick={() => onAskAbout(claimAskContext(label, claim))}
      >
        <LuMessageCircleQuestion /> Ask about this
      </Button>
      <Menu.Root
        positioning={{ placement: "bottom-start" }}
        onSelect={(details) =>
          onAskAbout(claimAskContext(label, claim), details.value)
        }
      >
        <Menu.Trigger asChild>
          <IconButton
            aria-label="Suggested questions"
            size="xs"
            variant="outline"
          >
            <LuChevronDown />
          </IconButton>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content>
              {suggestedQuestions[label].map((suggestion) => (
                <Menu.Item key={suggestion} value={suggestion}>
                  {suggestion}
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </Group>
  );
}
