// PR bodies and comments in private repos embed images as GitHub attachment
// URLs, which need auth a plain <img> can't send. Those get rewritten to the
// gh-asset:// protocol, which the main process serves using the stored token
// (see main/github/assets.ts). Everything else is left untouched.
const attachmentPatterns = [
  /^https:\/\/github\.com\/user-attachments\/assets\/[\w-]+$/,
  /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/assets\/[\w-]+$/,
];

// GitHub's rendered pages use signed private-user-images URLs whose token
// expires within minutes. The filename ends with the attachment id, so we can
// re-request it fresh through the proxy instead of showing a broken image.
const privateImagePattern =
  /^https:\/\/private-user-images\.githubusercontent\.com\/.*-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.\w+(?:\?|$)/;

function proxied(url: string): string {
  return `gh-asset://proxy?url=${encodeURIComponent(url)}`;
}

export function toDisplayableImageSrc(
  src: string | undefined,
): string | undefined {
  if (!src) return src;
  if (attachmentPatterns.some((pattern) => pattern.test(src))) {
    return proxied(src);
  }
  const attachmentId = privateImagePattern.exec(src)?.[1];
  if (attachmentId) {
    return proxied(
      `https://github.com/user-attachments/assets/${attachmentId}`,
    );
  }
  return src;
}
