import { Text, type TextProps } from "@chakra-ui/react";
import { formatDateTime } from "../lib/formatDate";
import { timeAgo } from "../lib/recentPrs";

interface Props extends TextProps {
  iso: string;
}

// Shows a relative time ("3h ago") with the exact date/time on hover.
export default function RelativeTime({ iso, ...rest }: Props) {
  return (
    <Text as="span" title={formatDateTime(iso)} {...rest}>
      {timeAgo(iso)}
    </Text>
  );
}
