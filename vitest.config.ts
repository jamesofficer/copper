import { defineConfig } from "vitest/config";

// Deliberately not electron.vite.config.ts: that file describes three bundles
// (main/preload/renderer) for a packaged app, none of which a unit test needs.
// Vitest looks for vitest.config.ts by name, so the two never collide.
export default defineConfig({
  test: {
    // Node, not jsdom. Everything covered so far is either main-process code or
    // a renderer module that imports nothing but types, so no DOM is required.
    // Component tests would need jsdom plus a Chakra/TanStack harness — a
    // separate decision, not a default to pay for now.
    environment: "node",
    include: ["src/**/*.test.ts"],
    // No `globals: true`. Both tsconfigs already include src/**/*, so tests are
    // typechecked by `pnpm typecheck`; importing describe/it/expect explicitly
    // keeps that working without adding a `types` entry to two tsconfigs.
    globals: false,
  },
});
