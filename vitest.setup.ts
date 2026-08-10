import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom implements the DOM but not the browser APIs around it. Everything
// stubbed here is used by app or Chakra code that would otherwise throw on
// import or on mount. Each stub is the smallest thing that satisfies its
// caller — a test that cares about the behaviour should stub it locally with
// real values instead of leaning on these.

// lib/colorMode.ts calls this at MODULE scope, so any import chain that
// reaches it throws before a test body runs. Reporting "no match" keeps the
// resolved mode deterministic: "system" lands on light, and a test that wants
// dark sets the class directly.
window.matchMedia = (query: string): MediaQueryList =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;

// DiffLines observes its container to decide whether a diff renders split.
// The stub never fires, so a diff under test stays inline — the default.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
window.ResizeObserver =
  ResizeObserverStub as unknown as typeof window.ResizeObserver;

// Used by the analysis panes to jump to an anchor. jsdom has no layout, so
// there is nothing to scroll and nothing to assert beyond "it was called".
Element.prototype.scrollIntoView = () => {};

// Opening a Chakra select scrolls its list back to the top. jsdom has no
// layout, so the call is a no-op — but without the method Ark UI throws from a
// state machine action, outside any test's call stack, which fails the run
// rather than the assertion.
Element.prototype.scrollTo = () => {};

// Ark UI (under Chakra v3) captures the pointer on every drag interaction, and
// the diff's drag-to-select does the same. jsdom ships neither method.
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};
Element.prototype.hasPointerCapture = () => false;

// With globals: false, Testing Library does not register its own afterEach, so
// unmounting is on us. Without this each test leaves its tree in the document
// and queries start matching the previous test's markup.
afterEach(cleanup);
