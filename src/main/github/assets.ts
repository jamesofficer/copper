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
    { scheme: "gh-asset", privileges: { standard: true, secure: true } },
  ]);
}

export function handleAssetRequests(): void {
  protocol.handle("gh-asset", async (request) => {
    const target = new URL(request.url).searchParams.get("url") ?? "";
    if (!allowedTargets.some((pattern) => pattern.test(target))) {
      return new Response("Blocked non-attachment URL.", { status: 403 });
    }

    const token = await getGitHubToken();
    const upstream = await fetch(target, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      redirect: "manual",
    });

    // GitHub answers with a redirect to a short-lived signed S3 URL. Follow
    // it without the token — S3 rejects requests carrying both a signature
    // and an Authorization header.
    const location = upstream.headers.get("location");
    if (upstream.status >= 300 && upstream.status < 400 && location) {
      return fetch(location);
    }
    return upstream;
  });
}
