import type { ReactNode } from "react";
import { useState } from "react";
import { toDisplayableImageSrc } from "../lib/githubImages";

interface Props {
  href: string;
  // Shown when the attachment turns out not to be playable video — a zip, a
  // PDF, or a codec the browser can't decode. Normally the original link.
  fallback: ReactNode;
}

// A GitHub attachment URL carries no file extension and no content type, so
// there's no way to know from the link alone whether it's a video. GitHub
// answers that server-side; we try to play it and fall back to the plain link,
// which is what the reviewer had before either way. Sizing comes from the
// prose styles in Markdown.tsx, like images.
export default function AttachmentMedia({ href, fallback }: Props) {
  const [playable, setPlayable] = useState(true);

  if (!playable) return <>{fallback}</>;

  return (
    // biome-ignore lint/a11y/useMediaCaption: attachments have no caption track
    <video
      controls
      preload="metadata"
      src={toDisplayableImageSrc(href)}
      onError={() => setPlayable(false)}
    />
  );
}
