import { Text, type TextProps } from "@chakra-ui/react";
import { formatDateTime } from "../lib/formatDate";
import { timeAgo } from "../lib/recentPrs";

interface Props extends TextProps {
  iso: string;
}

// Shows a relative time ("3h ago") with the exact date/time on hover. Renders
// nothing at all for a date that doesn't parse, rather than an empty tooltip
// over the words "Invalid Date".
export default function RelativeTime({ iso, ...rest }: Props) {
  const label = timeAgo(iso);
  if (!label) return null;
  return (
    <Text as="span" title={formatDateTime(iso)} {...rest}>
      {label}
    </Text>
  );
}
