import { Badge, Button, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import { LuUndo2 } from "react-icons/lu";
import {
  categoryMeta,
  issueVerdict,
  type ReviewIssue,
  verdictMeta,
} from "../lib/issues";
import { useIssueResolution } from "../lib/useIssueResolution";

interface Props {
  issues: ReviewIssue[];
  repo: string;
  prNumber: number;
  onSelect(issueId: string): void;
}

function statusText(issue: ReviewIssue): string {
  if (issue.kind === "risk" && issue.status === "cleared") {
    return "Checked by the agent";
  }
  const resolution =
    issue.kind === "finding" ? issue.finding.resolution : issue.risk.resolution;
  return resolution === "accepted" ? "Added to review" : "Dismissed";
}

// The collapsed home of everything handled: accepted and dismissed issues
// (restorable) and risks the agent checked and cleared.
export default function ResolvedIssuesPane({
  issues,
  repo,
  prNumber,
  onSelect,
}: Props) {
  const resolve = useIssueResolution(repo, prNumber);

  return (
    <VStack alignItems="stretch" gap="4" maxW="3xl">
      <Heading size="md">Resolved ({issues.length})</Heading>
      <VStack alignItems="stretch" gap="2">
        {issues.map((issue) => {
          const restorable =
            issue.kind === "finding"
              ? Boolean(issue.finding.resolution)
              : Boolean(issue.risk.resolution);
          return (
            <HStack
              key={issue.id}
              as="button"
              onClick={() => onSelect(issue.id)}
              textAlign="left"
              cursor="pointer"
              gap="2"
              px="3"
              py="2"
              borderWidth="1px"
              rounded="md"
              bg="bg.subtle"
              opacity="0.85"
              _hover={{ bg: "bg.emphasized" }}
              title={issue.kind === "risk" ? issue.note : undefined}
            >
              {issue.kind === "finding" ? (
                <Badge
                  colorPalette={categoryMeta[issue.finding.category].palette}
                  variant="surface"
                  size="sm"
                >
                  {categoryMeta[issue.finding.category].label}
                </Badge>
              ) : (
                <Badge
                  colorPalette={verdictMeta[issueVerdict(issue)].palette}
                  variant="surface"
                  size="sm"
                >
                  {verdictMeta[issueVerdict(issue)].label}
                </Badge>
              )}
              <Text fontSize="sm" color="fg.muted" truncate flex="1">
                {issue.title}
              </Text>
              <Text fontSize="xs" color="fg.subtle" flexShrink="0">
                {statusText(issue)}
              </Text>
              {restorable && (
                <Button
                  size="2xs"
                  variant="ghost"
                  color="fg.muted"
                  flexShrink="0"
                  loading={resolve.isPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    resolve.mutate({ id: issue.id, resolution: "open" });
                  }}
                >
                  <LuUndo2 /> Restore
                </Button>
              )}
            </HStack>
          );
        })}
      </VStack>
    </VStack>
  );
}
