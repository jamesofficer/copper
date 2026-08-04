const API = "https://api.github.com";

// GitHub's secondary rate limit trips on *concurrency*, not just volume: it
// allows roughly 100 requests in flight, and it penalises bursts against the
// same endpoint family. The app's PR lists are N+1 by nature (one call per PR
// for its detail, one for its reviews), so a repo with 50 open PRs fires 100
// requests at once — and the home screen starts three of those lists together.
// Every request therefore goes through one gate: a small pool of slots, plus a
// shared pause that every waiting request respects when GitHub tells us to
// back off.
const MAX_IN_FLIGHT = 6;
const MAX_ATTEMPTS = 3;
// Never sit and wait longer than this. A primary-limit reset can be an hour
// away, and blocking a UI query for an hour is worse than a clear error.
const MAX_WAIT_MS = 30_000;

let inFlight = 0;
const waiting: Array<() => void> = [];

// When any request is told to back off, every other request waits too —
// otherwise the 90 requests queued behind it keep the limit tripped.
let pausedUntil = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireSlot(): Promise<void> {
  // A loop, not a single await: the slot a release hands over can be taken by
  // another caller before this one resumes, so re-check the count.
  while (inFlight >= MAX_IN_FLIGHT) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  inFlight += 1;
}

function releaseSlot(): void {
  inFlight -= 1;
  waiting.shift()?.();
}

// Whether GitHub asked us to retry later, and after how long. Null means this
// is not a rate-limit response (or the wait is too long to be worth it), so
// the caller must handle it as a normal failure.
async function retryDelayMs(
  res: Response,
  attempt: number,
): Promise<number | null> {
  if (res.status !== 403 && res.status !== 429) return null;

  // Retry-After is authoritative and is what secondary limits usually send.
  const retryAfter = Number(res.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    const wait = retryAfter * 1000;
    return wait <= MAX_WAIT_MS ? wait : null;
  }

  // A spent primary limit: wait for the reset window if it is close.
  if (res.headers.get("x-ratelimit-remaining") === "0") {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    if (!Number.isFinite(reset)) return null;
    const wait = reset * 1000 - Date.now();
    if (wait <= 0) return 0;
    return wait <= MAX_WAIT_MS ? wait : null;
  }

  // A secondary limit with no Retry-After. Only the message distinguishes it
  // from an ordinary permission 403, so read a copy of the body — the original
  // stays unread for the caller's error reporting.
  if (!(await mentionsRateLimit(res))) return null;
  return Math.min(5000 * 4 ** (attempt - 1), MAX_WAIT_MS);
}

async function mentionsRateLimit(res: Response): Promise<boolean> {
  try {
    const body = await res.clone().text();
    return body.toLowerCase().includes("rate limit");
  } catch {
    return false;
  }
}

export interface GitHubRequestInit {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

// The single door to api.github.com. Returns the raw Response — status
// handling stays with the callers, which each treat 404s and 403s
// differently.
export async function githubRequest(
  token: string,
  path: string,
  init?: GitHubRequestInit,
): Promise<Response> {
  await acquireSlot();
  try {
    for (let attempt = 1; ; attempt += 1) {
      const pause = pausedUntil - Date.now();
      if (pause > 0) await sleep(pause);

      const res = await fetch(`${API}${path}`, {
        method: init?.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "pr-reviewer",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(init?.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
          ...init?.headers,
        },
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      });

      const delay = await retryDelayMs(res, attempt);
      if (delay === null || attempt >= MAX_ATTEMPTS) return res;

      pausedUntil = Math.max(pausedUntil, Date.now() + delay);
      await sleep(delay);
    }
  } finally {
    releaseSlot();
  }
}
