import React from "react";
import ReactDOM from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { broadcastResponseToMainFrame } from "@azure/msal-browser/redirect-bridge";
import { msalInstance } from "./config/msal";
import { queryClient } from "./app/queryClient";
import App from "./App";
import "./index.css";

async function bootstrap() {
  // In MSAL v5 popup flow, the popup window loads the full app.
  // We must broadcast the auth response back to the parent window before rendering.
  // broadcastResponseToMainFrame throws if there is no auth response in the URL,
  // which means we're in a normal (non-popup-return) page load — continue as usual.
  try {
    await broadcastResponseToMainFrame();
    // Popup: response sent to parent, window.close() called — skip rendering.
    // Redirect: navigation handled internally — skip rendering.
    return;
  } catch {
    // No auth response in URL — normal app load, proceed.
  }

  await msalInstance.initialize();

  // Restore active account from cache if exists
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0]);
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MsalProvider>
    </React.StrictMode>
  );
}

bootstrap();
