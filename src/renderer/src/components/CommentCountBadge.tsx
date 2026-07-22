import { Badge } from "@chakra-ui/react";
import { LuMessageSquare } from "react-icons/lu";

interface Props {
  count: number;
}

// The gray comment-count chip used on PR cards and sidebar rows. Renders
// nothing for comment-less PRs.
export default function CommentCountBadge({ count }: Props) {
  if (count === 0) return null;
  return (
    <Badge colorPalette="gray" variant="surface">
      <LuMessageSquare size={10} />
      {count}
    </Badge>
  );
}
