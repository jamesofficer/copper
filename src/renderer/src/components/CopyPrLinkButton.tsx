import { Button } from "@chakra-ui/react";
import { LuCheck, LuLink } from "react-icons/lu";
import { useCopyToClipboard } from "../lib/useCopyToClipboard";

interface Props {
  url: string;
}

// Copy the PR's github.com link to the clipboard, with a brief "Copied"
// confirmation on the button itself.
export default function CopyPrLinkButton({ url }: Props) {
  const { copied, copy } = useCopyToClipboard({
    errorTitle: "Couldn’t copy the link",
  });

  return (
    <Button
      variant="outline"
      size="xs"
      title={url}
      onClick={() => void copy(url)}
    >
      {copied ? <LuCheck /> : <LuLink />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}
