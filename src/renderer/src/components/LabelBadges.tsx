import { Badge, Wrap } from "@chakra-ui/react";
import type { GitHubLabel } from "../../../shared/types";
import { labelPalette } from "../lib/labelColor";

interface Props {
  labels: GitHubLabel[];
  size?: "sm" | "md";
}

// A GitHub label set as themed chips. Renders nothing when there are no
// labels, so callers don't need their own guard.
export default function LabelBadges({ labels, size = "md" }: Props) {
  if (labels.length === 0) return null;
  return (
    <Wrap gap={size === "sm" ? "1" : "2"}>
      {labels.map((label) => (
        <Badge
          key={label.name}
          variant="surface"
          size={size}
          colorPalette={labelPalette(label.color)}
        >
          {label.name}
        </Badge>
      ))}
    </Wrap>
  );
}
