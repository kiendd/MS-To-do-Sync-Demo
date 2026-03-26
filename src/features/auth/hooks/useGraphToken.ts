import { useMsal, useAccount } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { TOKEN_REQUEST } from "../../../config/scopes";

export function useGraphToken() {
  const { instance, accounts } = useMsal();
  const account = useAccount(accounts[0] ?? ({} as Parameters<typeof useAccount>[0]));

  const getToken = async (): Promise<string> => {
    if (!account) throw new Error("No account signed in");
    try {
      const response = await instance.acquireTokenSilent({
        ...TOKEN_REQUEST,
        account,
      });
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        const response = await instance.acquireTokenPopup({
          ...TOKEN_REQUEST,
          account,
        });
        return response.accessToken;
      }
      throw error;
    }
  };

  return { getToken, account };
}
