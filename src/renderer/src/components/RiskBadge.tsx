import { Badge } from "@chakra-ui/react";
import type { ChangeGroupRisk } from "../../../shared/types";

interface Props {
  risk: ChangeGroupRisk;
}

const riskMeta: Record<ChangeGroupRisk, { label: string; palette: string }> = {
  attention: { label: "Needs attention", palette: "orange" },
  routine: { label: "Routine", palette: "blue" },
  mechanical: { label: "Mechanical", palette: "gray" },
};

export default function RiskBadge({ risk }: Props) {
  const meta = riskMeta[risk];
  return (
    <Badge colorPalette={meta.palette} variant="surface" flexShrink="0">
      {meta.label}
    </Badge>
  );
}
