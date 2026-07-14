import React from "react";
import { createRoot } from "react-dom/client";
import { ChakraProvider } from "@chakra-ui/react";
import App from "./App";
import { Toaster } from "./components/ui/toaster";
import { system } from "./theme";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found");

createRoot(rootElement).render(
	<React.StrictMode>
		<ChakraProvider value={system}>
			<App />
			<Toaster />
		</ChakraProvider>
	</React.StrictMode>,
);
