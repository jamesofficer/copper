import { Heading } from "@chakra-ui/react";
import type { ReactNode } from "react";

// The small uppercase heading that titles a block inside a reading panel —
// "Description", "Conversation (4)", "Add a comment". One component so the
// pull-request and issue overviews can't drift apart.
export default function SectionHeading({
  children,
  mb = "3",
}: {
  children: ReactNode;
  mb?: string;
}) {
  return (
    <Heading
      size="xs"
      color="fg.muted"
      textTransform="uppercase"
      letterSpacing="wider"
      mb={mb}
    >
      {children}
    </Heading>
  );
}
