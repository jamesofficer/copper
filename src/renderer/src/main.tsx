import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import { ChakraProvider } from "@chakra-ui/react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Toaster } from "./components/ui/toaster";
import { applyAccent, getAccent } from "./lib/accent";
import { applyColorMode, getColorMode } from "./lib/colorMode";
import { persistOptions, queryClient } from "./lib/queryClient";
import { system } from "./theme";

applyAccent(getAccent());
applyColorMode(getColorMode());

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found");

createRoot(rootElement).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
    >
      <ChakraProvider value={system}>
        <App />
        <Toaster />
      </ChakraProvider>
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
