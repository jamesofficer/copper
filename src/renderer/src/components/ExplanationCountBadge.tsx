import { Badge } from "@chakra-ui/react";
import { LuSparkles } from "react-icons/lu";

interface Props {
  count: number;
}

// The AI-explanation count chip in the Changes file list. Accent-tinted (no
// colorPalette override, so it follows the app accent) and sparkle-marked so
// it never reads as a GitHub comment count. Renders nothing for files
// without explanations.
export default function ExplanationCountBadge({ count }: Props) {
  if (count === 0) return null;
  return (
    <Badge variant="surface">
      <LuSparkles size={10} />
      {count}
    </Badge>
  );
}
