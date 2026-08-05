import { afterEach, describe, expect, it, vi } from "vitest";

// The gate keeps its pool and its shared pause in module scope, which is right
// for the app (one gate per process) and hostile to tests: a pausedUntil left
// behind by one case would stall every later one. So each test imports a fresh
// copy rather than sharing state.
async function loadGate() {
  vi.resetModules();
  return import("./rateLimit");
}

function jsonResponse(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

// Epoch seconds, as x-ratelimit-reset reports them.
function resetIn(seconds: number): string {
  return String(Math.floor(Date.now() / 1000) + seconds);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("hasGraphQlRateLimitError", () => {
  it("catches the primary limit, which is typed", async () => {
    const { hasGraphQlRateLimitError } = await loadGate();
    expect(
      hasGraphQlRateLimitError({ errors: [{ type: "RATE_LIMITED" }] }),
    ).toBe(true);
  });

  // The secondary limit is the one this gate exists for, and GitHub only
  // signals it in the message — there is no type to match on.
  it("catches the secondary limit, which is only a message", async () => {
    const { hasGraphQlRateLimitError } = await loadGate();
    expect(
      hasGraphQlRateLimitError({
        errors: [{ message: "You have exceeded a secondary rate limit." }],
      }),
    ).toBe(true);
  });

  it.each([
    ["a clean response", { data: { viewer: { login: "octocat" } } }],
    ["an unrelated error", { errors: [{ type: "NOT_FOUND" }] }],
    ["no errors key", {}],
    ["null", null],
  ])("ignores %s", async (_label, body) => {
    const { hasGraphQlRateLimitError } = await loadGate();
    expect(hasGraphQlRateLimitError(body)).toBe(false);
  });
});

describe("githubRequest concurrency", () => {
  it("never exceeds the pool size, and still completes every request", async () => {
    const { githubRequest } = await loadGate();
    let inFlight = 0;
    let peak = 0;
    let calls = 0;

    vi.stubGlobal("fetch", async () => {
      inFlight += 1;
      calls += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return jsonResponse({ ok: true });
    });

    await Promise.all(
      Array.from({ length: 60 }, (_, i) => githubRequest("token", `/p/${i}`)),
    );

    expect(peak).toBe(6);
    expect(calls).toBe(60);
  });
});

describe("githubRequest rate-limit handling", () => {
  it("retries a secondary 403 after Retry-After", async () => {
    vi.useFakeTimers();
    const { githubRequest } = await loadGate();
    let calls = 0;

    vi.stubGlobal("fetch", async () => {
      calls += 1;
      if (calls === 1) {
        return jsonResponse(
          { message: "You have exceeded a secondary rate limit." },
          { status: 403, headers: { "retry-after": "1" } },
        );
      }
      return jsonResponse({ ok: true });
    });

    const pending = githubRequest("token", "/repos/o/r/pulls");
    await vi.advanceTimersByTimeAsync(1000);
    const res = await pending;

    expect(calls).toBe(2);
    expect(res.status).toBe(200);
  });

  // GraphQL answers with HTTP 200 and puts the limit in the body, so nothing in
  // the status line would have triggered the gate.
  it("retries a GraphQL secondary limit sent as a 200", async () => {
    vi.useFakeTimers();
    const { githubRequest } = await loadGate();
    let calls = 0;

    vi.stubGlobal("fetch", async () => {
      calls += 1;
      if (calls === 1) {
        return jsonResponse(
          {
            errors: [{ message: "You have exceeded a secondary rate limit." }],
          },
          { headers: { "retry-after": "1" } },
        );
      }
      return jsonResponse({ data: { ok: true } });
    });

    const pending = githubRequest("token", "/graphql", {
      method: "POST",
      body: { query: "{ viewer { login } }" },
    });
    await vi.advanceTimersByTimeAsync(1000);
    const res = await pending;

    expect(calls).toBe(2);
    expect(res.status).toBe(200);
  });

  // A spent points budget can be most of an hour out. Sleeping on that would
  // freeze a UI query for longer than the user will wait, so it fails instead.
  it("fails fast when the reset is further out than the cap", async () => {
    const { githubRequest } = await loadGate();
    let calls = 0;

    vi.stubGlobal("fetch", async () => {
      calls += 1;
      return jsonResponse(
        { errors: [{ type: "RATE_LIMITED" }] },
        { headers: { "x-ratelimit-reset": resetIn(3600) } },
      );
    });

    const res = await githubRequest("token", "/graphql", {
      method: "POST",
      body: {},
    });

    // One call is the whole proof: a delay and a retry are the same branch, so
    // sleeping here would necessarily have produced a second call. Asserting on
    // elapsed wall-clock instead would add nothing catchable and could only
    // ever fire on a loaded runner. A regression that did reinstate the long
    // wait blows the test timeout, which is the real backstop.
    expect(calls).toBe(1);
    expect(res.status).toBe(200);
  });

  it("fails fast when Retry-After exceeds the cap", async () => {
    const { githubRequest } = await loadGate();
    let calls = 0;

    vi.stubGlobal("fetch", async () => {
      calls += 1;
      return jsonResponse(
        { message: "secondary rate limit" },
        { status: 403, headers: { "retry-after": "31" } },
      );
    });

    await githubRequest("token", "/x");
    expect(calls).toBe(1);
  });

  it("gives up after the attempt limit rather than looping", async () => {
    vi.useFakeTimers();
    const { githubRequest } = await loadGate();
    let calls = 0;

    vi.stubGlobal("fetch", async () => {
      calls += 1;
      return jsonResponse(
        { message: "secondary rate limit" },
        { status: 429, headers: { "retry-after": "1" } },
      );
    });

    const pending = githubRequest("token", "/x");
    await vi.advanceTimersByTimeAsync(10_000);
    const res = await pending;

    expect(calls).toBe(3);
    expect(res.status).toBe(429);
  });

  // The pause is re-checked in a loop rather than slept through once, because a
  // second limit can push it further out while a sibling is already waiting.
  // This needs three requests: one to open the pause, one that is already in
  // flight and extends it later, and one sibling that must respect the
  // extension instead of waking on the original deadline.
  it("respects a pause that is extended while it waits", async () => {
    vi.useFakeTimers();
    const { githubRequest } = await loadGate();
    const fired: Array<{ path: string; at: number }> = [];
    const start = Date.now();
    let fastLimited = false;
    let slowLimited = false;

    vi.stubGlobal("fetch", async (url: string) => {
      const path = new URL(url).pathname;
      fired.push({ path, at: Date.now() - start });
      if (path === "/fast-limit" && !fastLimited) {
        fastLimited = true;
        return jsonResponse(
          { message: "secondary rate limit" },
          { status: 403, headers: { "retry-after": "1" } },
        );
      }
      if (path === "/slow-limit" && !slowLimited) {
        slowLimited = true;
        // Answers late, so its longer pause lands while the sibling sleeps.
        await new Promise((resolve) => setTimeout(resolve, 500));
        return jsonResponse(
          { message: "secondary rate limit" },
          { status: 403, headers: { "retry-after": "3" } },
        );
      }
      return jsonResponse({ ok: true });
    });

    const fast = githubRequest("token", "/fast-limit");
    const slow = githubRequest("token", "/slow-limit");
    // Both are in flight before any pause exists; the fast one now sets it to
    // t+1000.
    await vi.advanceTimersByTimeAsync(0);

    const sibling = githubRequest("token", "/sibling");
    // At t+500 the slow limit lands and pushes the pause out to t+3500, while
    // the sibling is still asleep on the original t+1000 deadline.
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(3000);
    await Promise.all([fast, slow, sibling]);

    // Waking on the stale deadline would fire this at 1000.
    expect(fired.find((f) => f.path === "/sibling")?.at).toBe(3500);
  });

  it("holds a later request back while one is paused", async () => {
    vi.useFakeTimers();
    const { githubRequest } = await loadGate();
    const fired: Array<{ path: string; at: number }> = [];
    const start = Date.now();
    let limitedOnce = false;

    vi.stubGlobal("fetch", async (url: string) => {
      const path = new URL(url).pathname;
      fired.push({ path, at: Date.now() - start });
      if (path === "/limited" && !limitedOnce) {
        limitedOnce = true;
        return jsonResponse(
          { message: "secondary rate limit" },
          { status: 403, headers: { "retry-after": "2" } },
        );
      }
      return jsonResponse({ ok: true });
    });

    const limited = githubRequest("token", "/limited");
    // Let the 403 land and set the shared pause before the sibling starts.
    await vi.advanceTimersByTimeAsync(0);
    const sibling = githubRequest("token", "/sibling");
    await vi.advanceTimersByTimeAsync(2000);
    await Promise.all([limited, sibling]);

    const siblingFire = fired.find((f) => f.path === "/sibling");
    expect(siblingFire?.at).toBe(2000);
  });
});

describe("githubRequest non-rate-limit responses", () => {
  it("does not retry an ordinary permission 403, and leaves the body readable", async () => {
    const { githubRequest } = await loadGate();
    let calls = 0;

    vi.stubGlobal("fetch", async () => {
      calls += 1;
      return jsonResponse(
        { message: "Resource not accessible by integration" },
        { status: 403 },
      );
    });

    const res = await githubRequest("token", "/repos/o/r");
    const body = (await res.json()) as { message: string };

    expect(calls).toBe(1);
    expect(body.message).toBe("Resource not accessible by integration");
  });

  it("does not retry an unrelated GraphQL error", async () => {
    const { githubRequest } = await loadGate();
    let calls = 0;

    vi.stubGlobal("fetch", async () => {
      calls += 1;
      return jsonResponse({
        errors: [{ type: "NOT_FOUND", message: "Could not resolve" }],
      });
    });

    await githubRequest("token", "/graphql", { method: "POST", body: {} });
    expect(calls).toBe(1);
  });

  // Guards the narrow scoping of the body check: the words appear in ordinary
  // GitHub data all the time — this very repo has a PR titled like this.
  it("does not mistake a successful body that mentions rate limits", async () => {
    const { githubRequest } = await loadGate();
    let calls = 0;

    vi.stubGlobal("fetch", async () => {
      calls += 1;
      return jsonResponse({
        title: "fix: stop tripping GitHub's secondary rate limit",
      });
    });

    await githubRequest("token", "/repos/o/r/pulls/8");
    expect(calls).toBe(1);
  });
});

describe("githubRequest request shape", () => {
  it("sends auth and GitHub headers, and omits Content-Type without a body", async () => {
    const { githubRequest } = await loadGate();
    let seen: { url: string; init: RequestInit } | null = null;

    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      seen = { url, init };
      return jsonResponse({});
    });

    await githubRequest("secret-token", "/repos/o/r/pulls/1", {
      method: "DELETE",
    });

    const captured = seen as unknown as { url: string; init: RequestInit };
    const headers = captured.init.headers as Record<string, string>;
    expect(captured.url).toBe("https://api.github.com/repos/o/r/pulls/1");
    expect(captured.init.method).toBe("DELETE");
    expect(headers.Authorization).toBe("Bearer secret-token");
    expect(headers.Accept).toBe("application/vnd.github+json");
    expect(headers["Content-Type"]).toBeUndefined();
    expect(captured.init.body).toBeUndefined();
  });

  it("serialises a body and sets Content-Type with it", async () => {
    const { githubRequest } = await loadGate();
    let seen: RequestInit | null = null;

    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      seen = init;
      return jsonResponse({});
    });

    await githubRequest("token", "/graphql", {
      method: "POST",
      body: { query: "{ viewer { login } }" },
    });

    const captured = seen as unknown as RequestInit;
    const headers = captured.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(captured.body).toBe('{"query":"{ viewer { login } }"}');
  });

  // peekPullRequestActivity relies on this to get 304s, which GitHub does not
  // count against the rate limit.
  it("passes caller headers through, such as If-None-Match", async () => {
    const { githubRequest } = await loadGate();
    let seen: RequestInit | null = null;

    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      seen = init;
      return jsonResponse({});
    });

    await githubRequest("token", "/repos/o/r/pulls/1", {
      headers: { "If-None-Match": 'W/"abc"' },
    });

    const headers = (seen as unknown as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headers["If-None-Match"]).toBe('W/"abc"');
  });
});
