import { useEffect, useRef, useState } from "react";
import { toaster } from "../components/ui/toaster";

interface Options {
  // Names what failed, since the toast is the only place a failure shows.
  errorTitle: string;
  // When set, success is a toast instead of the brief "Copied" button state.
  successTitle?: string;
}

// Copy-to-clipboard with the brief "Copied" state every copy button in the app
// shows. The flag resets itself after 1.5s, and the timer is cleared on unmount
// so a button copied and then navigated away from doesn't set state on nothing.
export function useCopyToClipboard({ errorTitle, successTitle }: Options): {
  copied: boolean;
  copy(text: string): Promise<void>;
} {
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return () => clearTimeout(timeout.current);
  }, []);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      if (successTitle) {
        toaster.create({ type: "success", title: successTitle });
      } else {
        setCopied(true);
        clearTimeout(timeout.current);
        timeout.current = setTimeout(() => setCopied(false), 1500);
      }
    } catch (cause) {
      toaster.create({
        type: "error",
        title: errorTitle,
        description: cause instanceof Error ? cause.message : String(cause),
        closable: true,
      });
    }
  }

  return { copied, copy };
}
