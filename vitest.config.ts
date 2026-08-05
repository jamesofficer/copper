import { defineConfig } from "vitest/config";

// Deliberately not electron.vite.config.ts: that file describes three bundles
// (main/preload/renderer) for a packaged app, none of which a unit test needs.
// Vitest looks for vitest.config.ts by name, so the two never collide.
export default defineConfig({
  test: {
    // Two environments, split by file extension rather than by directory: a
    // .tsx test renders components and needs a DOM, a .ts test does not. That
    // keeps every main-process and pure-module test on the fast node
    // environment without listing paths that go stale as the tree moves.
    // (Vitest 4 removed environmentMatchGlobs and workspace, so projects is
    // now the only way to run more than one environment in a single command.)
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          globals: false,
        },
      },
      {
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          // Stubs the browser APIs jsdom lacks. Must run before the test file
          // imports anything: lib/colorMode.ts calls window.matchMedia at
          // module scope, so an unstubbed import throws before a test starts.
          setupFiles: ["./vitest.setup.ts"],
          globals: false,
        },
      },
    ],
  },
});
