import { Button } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { LuCheck, LuLink } from "react-icons/lu";
import { toaster } from "./ui/toaster";

interface Props {
  url: string;
}

// Copy the PR's github.com link to the clipboard, with a brief "Copied"
// confirmation on the button itself.
export default function CopyPrLinkButton({ url }: Props) {
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return () => clearTimeout(timeout.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setCopied(false), 1500);
    } catch (cause) {
      toaster.create({
        type: "error",
        title: "Couldn’t copy the link",
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
    }
  }

  return (
    <Button variant="outline" size="xs" title={url} onClick={copy}>
      {copied ? <LuCheck /> : <LuLink />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}
