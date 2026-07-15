import { Badge } from "@chakra-ui/react";
import type { RiskSeverity } from "../../../shared/types";

const severityMeta: Record<RiskSeverity, { label: string; palette: string }> = {
  high: { label: "High risk", palette: "red" },
  medium: { label: "Medium risk", palette: "orange" },
  low: { label: "Low risk", palette: "yellow" },
};

// Nav-list dot colours, matching the chip palettes. Undefined severity
// (analyses cached before classification existed) falls back to the old
// uniform orange.
export function severityDotColor(severity: RiskSeverity | undefined): string {
  return severity ? `${severityMeta[severity].palette}.solid` : "orange.solid";
}

interface Props {
  severity?: RiskSeverity;
}

export default function RiskSeverityBadge({ severity }: Props) {
  if (!severity) return null;
  const meta = severityMeta[severity];
  return (
    <Badge colorPalette={meta.palette} variant="surface" flexShrink="0">
      {meta.label}
    </Badge>
  );
}
