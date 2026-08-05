import { ChakraProvider } from "@chakra-ui/react";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { system } from "../theme";

interface Options {
  // Seed the cache when a component reads a query another component owns.
  seed?(client: QueryClient): void;
}

// Mirrors the provider stack in main.tsx, with two deliberate differences.
//
// It uses QueryClientProvider, not PersistQueryClientProvider: persistence
// writes the cache to localStorage under a fixed key, which would leak one
// test's data into the next and make ordering matter.
//
// And the client is built per call rather than imported from lib/queryClient,
// for the same reason — that module exports a singleton shared by the whole
// app. Retries are off so an asserted failure surfaces immediately instead of
// after a backoff the test would have to wait out.
// The return type is inferred, not annotated: Testing Library binds its whole
// query set onto the result object, and naming RenderResult here loses them.
export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
  options.seed?.(queryClient);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ChakraProvider value={system}>
          <HotkeysProvider>{children}</HotkeysProvider>
        </ChakraProvider>
      </QueryClientProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper }), queryClient };
}
