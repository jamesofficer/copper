import type { WindowApi } from "../../../shared/ipc";

// The renderer reaches window.api from ~94 call sites against a 70-method
// interface, so writing a literal fake would mean 70 stubs that add nothing
// and rot on every IPC change. This is a Proxy instead: complete by
// construction, and a test declares only the handful of methods it exercises.
//
// An un-stubbed method throws by name rather than returning undefined. That
// matters because these are nearly all called through TanStack Query — an
// undefined return surfaces as "cannot read properties of undefined (reading
// 'then')" from inside the library, which says nothing about which call the
// component actually made.
//
// Each call replaces window.api wholesale, so calling it in a beforeEach is
// enough to keep tests isolated.
export function stubApi(overrides: Partial<WindowApi> = {}): void {
  const stubs = { ...overrides } as Record<string, unknown>;

  window.api = new Proxy(stubs, {
    get(target, property: string) {
      if (property in target) return target[property];
      return () => {
        throw new Error(
          `window.api.${property}() was called but not stubbed. Add it to the stubApi({...}) call in this test.`,
        );
      };
    },
  }) as unknown as WindowApi;
}
