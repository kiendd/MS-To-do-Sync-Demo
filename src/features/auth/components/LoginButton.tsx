import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { LOGIN_REQUEST } from "../../../config/scopes";
import { Button } from "../../../shared/components/ui/button";

export function LoginButton() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const handleLogin = async () => {
    try {
      const response = await instance.loginPopup(LOGIN_REQUEST);
      instance.setActiveAccount(response.account);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await instance.logoutPopup({
        postLogoutRedirectUri: window.location.origin,
      });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm">{accounts[0]?.name ?? accounts[0]?.username}</span>
        <Button variant="outline" onClick={handleLogout}>Sign Out</Button>
      </div>
    );
  }

  return <Button onClick={handleLogin}>Sign In with Microsoft</Button>;
}
