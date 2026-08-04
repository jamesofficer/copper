// Rate-limit wording lives here because it crosses the process boundary: the
// main process throws it, and the renderer's query client keys its "don't retry
// this" rule off it. Sharing the constant and the matcher makes that a real
// contract instead of two string literals that have to be kept in step.

export const RATE_LIMIT_MESSAGE =
  "GitHub is rate-limiting this app. Wait a minute, then try again.";

// GitHub is inconsistent about the hyphen ("rate limit" in its own error prose,
// "rate-limiting" in ours), so match both rather than depend on which layer
// produced the text.
export function isRateLimitMessage(text: string | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return lower.includes("rate limit") || lower.includes("rate-limit");
}
