import { AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";
import { LoginButton } from "./LoginButton";
import type { ReactNode } from "react";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  return (
    <>
      <AuthenticatedTemplate>{children}</AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">MS To-do Sync</h1>
            <p className="text-muted-foreground">Sign in with your Microsoft account to get started</p>
            <LoginButton />
          </div>
        </div>
      </UnauthenticatedTemplate>
    </>
  );
}
