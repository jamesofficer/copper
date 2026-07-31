import { protocol } from "electron";
import { getGitHubToken } from "./auth";

// Images attached to PRs in private repos (github.com/user-attachments/…)
// need GitHub auth the renderer's plain <img> can't provide. The renderer
// rewrites those srcs to gh-asset://proxy?url=…, and this handler fetches
// them with the stored token. Only exact attachment URLs are proxied — the
// token must never ride along to an arbitrary host.
const allowedTargets = [
  /^https:\/\/github\.com\/user-attachments\/assets\/[\w-]+$/,
  /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/assets\/[\w-]+$/,
];

export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "gh-asset",
      privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
  ]);
}

// A <video> served from a custom scheme only plays if the response advertises
// byte ranges: Chromium's media loader asks for a range and treats a plain 200
// as unsupported, so the player fails with MEDIA_ERR_SRC_NOT_SUPPORTED even
// though the bytes are right there. Images never cared, which is why this
// only showed up once videos could be attached. The upstream status and
// Content-Range are passed through untouched; only the advert is added.
function mediaReady(response: Response): Response {
  const headers = new Headers(response.headers);
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Playing a video means one request per byte range, and seeking through a long
// clip means many. Each would otherwise ask github.com to mint a fresh signed
// URL, so the redirect is remembered briefly. The signed URL outlives this by
// minutes; an expired one is retried from scratch below.
const signedUrls = new Map<string, { url: string; expires: number }>();
const signedUrlTtlMs = 60_000;

function rememberedSignedUrl(target: string): string | null {
  const cached = signedUrls.get(target);
  if (!cached) return null;
  if (cached.expires <= Date.now()) {
    signedUrls.delete(target);
    return null;
  }
  return cached.url;
}

// S3 rejects requests carrying both a signature and an Authorization header,
// so the signed URL is fetched without the token.
function fetchSigned(url: string, range: string | null): Promise<Response> {
  return fetch(url, { headers: range ? { Range: range } : {} });
}

export function handleAssetRequests(): void {
  protocol.handle("gh-asset", async (request) => {
    const target = new URL(request.url).searchParams.get("url") ?? "";
    if (!allowedTargets.some((pattern) => pattern.test(target))) {
      return new Response("Blocked non-attachment URL.", { status: 403 });
    }

    const range = request.headers.get("range");

    const remembered = rememberedSignedUrl(target);
    if (remembered) {
      const cached = await fetchSigned(remembered, range);
      if (cached.ok || cached.status === 206) return mediaReady(cached);
      // Signed URLs expire; fall through and resolve a fresh one.
      signedUrls.delete(target);
    }

    const token = await getGitHubToken();
    const upstream = await fetch(target, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      redirect: "manual",
    });

    // GitHub answers with a redirect to a short-lived signed S3 URL.
    const location = upstream.headers.get("location");
    if (upstream.status >= 300 && upstream.status < 400 && location) {
      signedUrls.set(target, {
        url: location,
        expires: Date.now() + signedUrlTtlMs,
      });
      return mediaReady(await fetchSigned(location, range));
    }
    return mediaReady(upstream);
  });
}
