import React from "react";
import ReactDOM from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { msalInstance } from "./config/msal";
import { queryClient } from "./app/queryClient";
import App from "./App";
import "./index.css";

async function bootstrap() {
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
