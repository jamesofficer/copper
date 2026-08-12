import { Badge } from "@chakra-ui/react";
import type { RiskSeverity } from "../../../shared/types";

const severityMeta: Record<RiskSeverity, { label: string; palette: string }> = {
  high: { label: "High", palette: "red" },
  medium: { label: "Medium", palette: "orange" },
  low: { label: "Low", palette: "blue" },
};

// Nav-list dot colours, matching the chip palettes. Undefined severity
// (analyses cached before classification existed) falls back to the old
// uniform orange.
export function severityDotColor(severity: RiskSeverity | undefined): string {
  return severity ? `${severityMeta[severity].palette}.solid` : "orange.solid";
}

interface Props {
  severity?: RiskSeverity;
  size?: "xs" | "sm" | "md" | "lg";
}

export default function RiskSeverityBadge({ severity, size }: Props) {
  if (!severity) return null;
  const meta = severityMeta[severity];
  return (
    <Badge
      colorPalette={meta.palette}
      variant="surface"
      size={size}
      flexShrink="0"
    >
      {meta.label}
    </Badge>
  );
}
