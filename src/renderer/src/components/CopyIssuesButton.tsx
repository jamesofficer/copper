import { IconButton } from "@chakra-ui/react";
import { useMemo } from "react";
import { LuCheck, LuCopy } from "react-icons/lu";
import type { PullRequestFile } from "../../../shared/types";
import {
  type IssueAnchorCommits,
  issuesToMarkdown,
} from "../lib/issueMarkdown";
import type { ReviewIssue } from "../lib/issues";
import { useCopyToClipboard } from "../lib/useCopyToClipboard";

interface Props {
  issues: ReviewIssue[];
  repo: string;
  prNumber: number;
  // Undefined while the PR's diffs load. The button waits for them rather than
  // copying a whole review with none of its code quoted.
  files: PullRequestFile[] | undefined;
  anchorCommits: IssueAnchorCommits;
}

// Copies every open issue as one markdown document — the bulk form of the copy
// button on an individual issue.
export default function CopyIssuesButton({
  issues,
  repo,
  prNumber,
  files,
  anchorCommits,
}: Props) {
  const { copied, copy } = useCopyToClipboard({
    errorTitle: "Couldn’t copy the issues",
  });

  const fileByPath = useMemo(
    () => new Map((files ?? []).map((file) => [file.path, file])),
    [files],
  );

  if (issues.length === 0) return null;

  return (
    <IconButton
      aria-label="Copy all issues as markdown"
      title={
        files
          ? `Copy all ${issues.length} issues as markdown`
          : "Waiting for the diff…"
      }
      size="2xs"
      variant="ghost"
      color="fg.muted"
      disabled={!files}
      onClick={() =>
        void copy(
          issuesToMarkdown(issues, {
            repo,
            prNumber,
            fileByPath,
            ...anchorCommits,
          }),
        )
      }
    >
      {copied ? <LuCheck /> : <LuCopy />}
    </IconButton>
  );
}
