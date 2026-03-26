---
area: MSAL Authentication
researcher: gsd-project-researcher
date: 2026-03-26
---

# MSAL Authentication Research

**Project context:** Browser-only SPA, no backend, Microsoft account auth, scopes needed: `Tasks.ReadWrite`, `offline_access`
**Confidence:** HIGH — all findings sourced directly from official Microsoft Entra / MSAL documentation (March 2026 versions)

---

## 1. MSAL.js Version Decision: v5 is Current (Not v3)

**Key correction:** The question was framed around v3 vs v2, but the current active version as of March 2026 is **v5**. v3 and v4 have both transitioned out of active support.

| Library | Active Version | LTS Version | Status |
|---------|---------------|-------------|--------|
| `@azure/msal-browser` | **v5.x (5.4.0)** | v2.x | v3/v4 — out of active support |
| `@azure/msal-react` | **v5.x (5.0.6)** | v1.x | — |
| `@azure/msal-angular` | **v5.x (5.1.1)** | v2.x | — |

**Decision: Use v5 for all new SPA development.** v2 is LTS only — receives critical security fixes but no new features. Starting a new project on anything below v5 means immediate technical debt.

**Install:**
```bash
npm install @azure/msal-browser @azure/msal-react
```

### What's new in v5 (relevant to this project)

- `localStorage` AES-GCM encryption: token cache in localStorage is now encrypted at rest (key = session cookie `msal.cache.encryption`, cleared on browser close)
- `createStandardPublicClientApplication` factory function: preferred async init pattern
- Cross-Origin-Opener-Policy (COOP) support: popup flows work in strict COOP environments
- Migration guides exist for v4→v5, v3→v5

---

## 2. Auth Flow: Authorization Code + PKCE

MSAL browser v5 **exclusively** implements Authorization Code Flow with PKCE. The implicit flow is explicitly not supported. This is correct for a SPA — PKCE eliminates the need for a client secret and is the current best practice mandated by Microsoft for all SPA types.

### How PKCE works (what MSAL does for you automatically)

1. Generate a random `code_verifier` (high-entropy random string, 43–128 chars)
2. Hash it with SHA-256 → produce `code_challenge`
3. Redirect user to `/authorize` endpoint with `code_challenge` and `code_challenge_method=S256`
4. User authenticates; Entra ID redirects back with a short-lived `authorization_code` (~1 minute TTL)
5. MSAL exchanges the `code` + original `code_verifier` at the `/token` endpoint → receives `access_token`, `refresh_token`, `id_token`
6. All tokens stored in browser cache

MSAL handles steps 1–6 internally. You call `loginPopup()` or `loginRedirect()` and receive tokens in the response.

### Authorization request parameters (what MSAL constructs)

| Parameter | Value for this project |
|-----------|----------------------|
| `response_type` | `code` |
| `scope` | `openid offline_access https://graph.microsoft.com/Tasks.ReadWrite` |
| `code_challenge_method` | `S256` |
| `state` | Random CSRF token (MSAL generates) |
| `redirect_uri` | Must match exactly what is registered in Azure portal |

### Popup vs Redirect choice

**Recommendation: Use popup (`loginPopup` / `acquireTokenPopup`)** for this project.

Reasons:
- Simpler state management — promises resolve directly, no `handleRedirectPromise()` pattern needed
- Better UX for a task-sync app where auth is secondary to app functionality
- No risk of losing in-flight app state during a redirect

Redirect is appropriate when popup blockers are a concern (mobile browsers, some enterprise environments). If you choose redirect, you **must** call and await `handleRedirectPromise()` on every page load, before any other MSAL call.

---

## 3. Token Management

### Token lifetimes

| Token | Default Lifetime | Notes |
|-------|-----------------|-------|
| Access token | 1 hour | Configurable via Entra ID token lifetime policy |
| ID token | 24 hours | Bound to account + client |
| Refresh token (SPA) | 24 hours, **non-sliding** | Fixed window; resets only by full re-auth |

**Critical SPA constraint:** Refresh tokens for SPAs (redirect URIs of type `spa`) have a hard 24-hour non-sliding window. After 24 hours, a new authorization code flow is required. MSAL handles this via a hidden iframe (silent re-auth using the browser session cookie). If third-party cookies are blocked (Safari ITP, Firefox ETP), the iframe approach fails and the user must interact.

### Silent renewal: how `acquireTokenSilent` works

MSAL follows this decision tree on every `acquireTokenSilent` call:

```
1. Check cache for valid (non-expired) access token
   → Found + not expired: return cached token immediately

2. Access token expired but refresh token still valid
   → Exchange refresh token at /token endpoint
   → Return new access token + new refresh token (old RT discarded)

3. Refresh token expired
   → Attempt silent re-auth via hidden iframe (SSO session cookie)
   → If iframe succeeds: return new token set
   → If iframe fails: throw InteractionRequiredAuthError
     → Caller must fall back to loginPopup() / loginRedirect()
```

### CacheLookupPolicy options (v5)

For most use cases, use `CacheLookupPolicy.Default` (the default). Use `CacheLookupPolicy.RefreshTokenAndNetwork` (equivalent to `forceRefresh: true`) only when you need a guaranteed fresh token at the start of a session.

### Token cache storage

Configure in the `cache` block of `PublicClientApplication`:

```typescript
import { BrowserCacheLocation } from "@azure/msal-browser";

const msalConfig = {
    auth: { clientId: "..." },
    cache: {
        cacheLocation: BrowserCacheLocation.LocalStorage, // or SessionStorage
        storeAuthStateInCookie: false,
    }
};
```

| Option | Behavior | Recommended for |
|--------|----------|----------------|
| `sessionStorage` (default) | Cleared on tab/window close. Not shared between tabs. | Highest security, single-tab apps |
| `localStorage` | Persists until browser close. Shared between tabs. Encrypted with AES-GCM in v4+. | Better UX, multi-tab apps |
| `memoryStorage` | Lost on page refresh. | Maximum security, testing |

**For a To-do sync app:** Use `localStorage` — users expect to stay signed in across tabs and sessions. The AES-GCM encryption in v5 mitigates the primary security concern.

### Recommended token acquisition pattern (React)

```typescript
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

const todoScopes = ["https://graph.microsoft.com/Tasks.ReadWrite", "offline_access"];

async function getAccessToken(instance, account) {
    try {
        const response = await instance.acquireTokenSilent({
            scopes: todoScopes,
            account: account,
        });
        return response.accessToken;
    } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
            // Refresh token expired or consent needed — require interaction
            const response = await instance.acquireTokenPopup({
                scopes: todoScopes,
                account: account,
            });
            return response.accessToken;
        }
        throw error;
    }
}
```

**Always call `acquireTokenSilent` first.** Never request a fresh token via interactive flow unless silent fails.

### Single instance rule

Instantiate exactly one `PublicClientApplication` for the entire app lifetime. Multiple instances cause cache conflicts and `interaction_in_progress` errors. In React this is enforced by creating the instance once outside the component tree and passing it to `MsalProvider`.

---

## 4. Azure AD App Registration Steps

### Step 1: Create the registration

1. Sign in to [Microsoft Entra admin center](https://entra.microsoft.com) (minimum role: Application Developer)
2. Navigate to: **Entra ID** → **App registrations** → **New registration**
3. Set **Name**: e.g., `MS To-do Sync Demo`
4. Set **Supported account types**:
   - "Accounts in this organizational directory only" — if internal/corporate use
   - "Accounts in any organizational directory and personal Microsoft accounts" — if users need personal Microsoft accounts (Outlook, Hotmail, etc.) for To-do access
   - **For personal To-do access, choose the third option above**
5. Leave **Redirect URI** blank for now (set below)
6. Click **Register**
7. Copy the **Application (client) ID** and **Directory (tenant) ID** from the Overview page

### Step 2: Configure Redirect URI (critical for SPA auth code flow)

1. In the app registration, go to **Authentication** → **Add a platform** → **Single-page application**
2. Add redirect URIs:
   - `http://localhost:5173` (or whatever port your dev server uses)
   - `http://localhost:3000` (if using Create React App)
   - Your production domain (e.g., `https://yourdomain.com`)
3. You will see a green checkmark: "Your Redirect URI is eligible for the Authorization Code Flow with PKCE"

**Platform type must be "Single-page application" — NOT "Web".** If you register it as type "Web", CORS will block token requests and you'll get: `access to XMLHttpRequest at login.microsoftonline.com has been blocked by CORS policy`.

### Step 3: Add API permissions for Microsoft To-do

1. In the app registration, go to **API permissions** → **Add a permission**
2. Select **Microsoft Graph** → **Delegated permissions**
3. Search and add:
   - `Tasks.ReadWrite` — "Read and write user tasks" (Microsoft To Do; no admin consent required)
   - `offline_access` — Required for refresh tokens (already listed under OpenID permissions)
   - `openid` — Required for ID tokens / sign-in (usually pre-added)
   - `User.Read` — Required to read signed-in user's profile (usually pre-added)
4. Click **Add permissions**
5. Admin consent is **not required** for `Tasks.ReadWrite` — users will consent themselves on first sign-in

### Permission identifiers

| Permission | Scope String | Admin Consent |
|-----------|-------------|---------------|
| Tasks.ReadWrite | `https://graph.microsoft.com/Tasks.ReadWrite` | No |
| Tasks.Read | `https://graph.microsoft.com/Tasks.Read` | No |
| offline_access | `offline_access` | No |
| openid | `openid` | No |
| User.Read | `https://graph.microsoft.com/User.Read` | No |

### Step 4: Note authority setting

For personal Microsoft accounts + work accounts (most inclusive), use:
```
authority: "https://login.microsoftonline.com/common"
```

For personal accounts only:
```
authority: "https://login.microsoftonline.com/consumers"
```

For a single organization only:
```
authority: "https://login.microsoftonline.com/{your-tenant-id}"
```

---

## 5. Common Auth Errors and Handling

### `InteractionRequiredAuthError`

**When:** `acquireTokenSilent` fails because user action is needed — expired refresh token, new consent required, MFA step-up, conditional access policy triggered.

**Handle by:** Falling back to `acquireTokenPopup` or `acquireTokenRedirect`. This is the most important error to handle correctly.

```typescript
catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
        return instance.acquireTokenPopup({ scopes, account });
    }
}
```

Specific sub-reasons within `InteractionRequiredAuthError`:
- `consent_required`: User hasn't consented to the requested scopes. First-time use or new scope added.
- `interaction_required`: Server requires user interaction (MFA, conditional access, password change).
- `login_required`: Session expired; user must re-authenticate.

### `interaction_in_progress`

**When:** An interactive API (`loginPopup`, `acquireTokenPopup`, `loginRedirect`) is called while another is already in progress.

**Root causes:**
- Calling interactive APIs concurrently without awaiting previous ones
- Using redirect flow and calling `loginRedirect` before `handleRedirectPromise()` has resolved
- React StrictMode double-invocation (in development) triggering duplicate calls

**Handle by:**
- Always `await` interactive MSAL calls
- Check `inProgress` from `useMsal()` before triggering new interactions
- For redirect flow: always await `handleRedirectPromise()` first

### `block_iframe_reload`

**When:** A page used as `redirectUri` also calls MSAL APIs (like `acquireTokenSilent`), causing MSAL to block it when loaded inside the hidden iframe used for silent renewal.

**Handle by:** Use a dedicated blank page as `redirectUri` for silent calls:
```typescript
instance.acquireTokenSilent({
    scopes: todoScopes,
    account: account,
    redirectUri: "http://localhost:5173/blank.html", // blank page, no MSAL code
});
```
Register this blank URI in the Azure portal.

### `monitor_window_timeout`

**When:** Silent iframe or popup doesn't redirect back in time (~10 seconds). Common causes: router stripping hash fragments, throttling by identity provider, network latency.

**Handle by:**
- Ensure React Router does not intercept or strip the hash on the redirect URI page
- The redirect URI page must not auto-navigate before MSAL extracts the response
- Increase timeout if needed: `system.iframeHashTimeout: 15000`

### `uninitialized_public_client_application`

**When:** Any MSAL API is called before `initialize()` has resolved.

**Handle by:** Always await initialization. With `MsalProvider` from `@azure/msal-react`, this is handled for you automatically. If creating `PublicClientApplication` manually:
```typescript
const msalInstance = new PublicClientApplication(config);
await msalInstance.initialize(); // must await before any other call
```

### CORS error on token endpoint

**Symptom:** `access to XMLHttpRequest at login.microsoftonline.com blocked by CORS`

**Cause:** Redirect URI is registered as platform type "Web" instead of "Single-page application" in the portal.

**Fix:** In Azure portal → Authentication → change the platform type to "Single-page application". Look for the green PKCE checkmark.

### MFA / Conditional Access

When an organization enforces MFA or conditional access policies, `acquireTokenSilent` throws `InteractionRequiredAuthError` with `error_code: interaction_required`. This cannot be avoided silently — you must trigger an interactive flow. The user will be prompted to complete MFA in the popup/redirect. After they complete it, subsequent silent calls will succeed until the session expires.

---

## 6. React Integration Patterns

### Setup: MsalProvider wrapping the app

Create the `PublicClientApplication` instance **once**, outside any component, and pass it to `MsalProvider`. Do not create it inside a component — it will be re-created on every render.

```typescript
// main.tsx or index.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import App from "./App";

const msalConfig = {
    auth: {
        clientId: import.meta.env.VITE_MSAL_CLIENT_ID,
        authority: "https://login.microsoftonline.com/common",
        redirectUri: window.location.origin,
    },
    cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false,
    },
};

const msalInstance = new PublicClientApplication(msalConfig);

createRoot(document.getElementById("root")!).render(
    <MsalProvider instance={msalInstance}>
        <App />
    </MsalProvider>
);
```

### Key hooks

**`useMsal()`** — The primary hook. Returns:
- `instance`: The `PublicClientApplication` object — call login/logout/acquireToken on it
- `accounts`: Array of all signed-in accounts
- `inProgress`: Current interaction status (`"none"`, `"login"`, `"logout"`, `"acquireToken"`, `"ssoSilent"`, `"handleRedirect"`)

```typescript
const { instance, accounts, inProgress } = useMsal();
```

**`useIsAuthenticated()`** — Returns `boolean`. Use for simple conditional rendering.

**`useAccount(account)`** — Returns account details for a specific account object.

**`useMsalAuthentication(interactionType, request?)`** — Auto-triggers login if user is not authenticated. Returns `{ result, error, login }`. Good for protected pages that require auth.

### Auth-gating patterns

Pattern A — Template components (declarative, simple):
```tsx
import { AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";

function App() {
    return (
        <>
            <AuthenticatedTemplate>
                <TodoApp />
            </AuthenticatedTemplate>
            <UnauthenticatedTemplate>
                <LoginPage />
            </UnauthenticatedTemplate>
        </>
    );
}
```

Pattern B — `MsalAuthenticationTemplate` (auto-triggers login):
```tsx
import { MsalAuthenticationTemplate } from "@azure/msal-react";
import { InteractionType } from "@azure/msal-browser";

function ProtectedTodoPage() {
    return (
        <MsalAuthenticationTemplate
            interactionType={InteractionType.Popup}
            authenticationRequest={{ scopes: ["https://graph.microsoft.com/Tasks.ReadWrite", "offline_access"] }}
            loadingComponent={() => <p>Signing in...</p>}
            errorComponent={({ error }) => <p>Error: {error?.message}</p>}
        >
            <TodoList />
        </MsalAuthenticationTemplate>
    );
}
```

Pattern C — `useMsalAuthentication` hook (programmatic, most flexible):
```tsx
import { useMsalAuthentication } from "@azure/msal-react";
import { InteractionType } from "@azure/msal-browser";

function TodoApp() {
    const { result, error } = useMsalAuthentication(InteractionType.Popup, {
        scopes: ["https://graph.microsoft.com/Tasks.ReadWrite", "offline_access"]
    });

    if (error) return <ErrorDisplay error={error} />;
    if (!result) return <LoadingSpinner />;
    return <TodoList />;
}
```

### Custom hook for Graph API calls

Encapsulate token acquisition in a custom hook to avoid repetition:

```typescript
// hooks/useGraphToken.ts
import { useMsal, useAccount } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

const TODO_SCOPES = ["https://graph.microsoft.com/Tasks.ReadWrite", "offline_access"];

export function useGraphToken() {
    const { instance, accounts } = useMsal();
    const account = useAccount(accounts[0] || {});

    const getToken = async (): Promise<string> => {
        if (!account) throw new Error("No account signed in");

        try {
            const response = await instance.acquireTokenSilent({
                scopes: TODO_SCOPES,
                account,
            });
            return response.accessToken;
        } catch (error) {
            if (error instanceof InteractionRequiredAuthError) {
                const response = await instance.acquireTokenPopup({
                    scopes: TODO_SCOPES,
                    account,
                });
                return response.accessToken;
            }
            throw error;
        }
    };

    return { getToken, account };
}
```

### Setting active account

With multiple accounts signed in, explicitly set which account to use:
```typescript
// After login, set the active account
instance.setActiveAccount(accounts[0]);

// Then acquireTokenSilent will use it by default
const response = await instance.acquireTokenSilent({ scopes: TODO_SCOPES });
```

Or retrieve it:
```typescript
const activeAccount = instance.getActiveAccount();
```

---

## 7. Security Best Practices

### PKCE is mandatory — no client secret in browser

SPAs must never use a `client_secret`. PKCE is the mechanism that secures public clients. MSAL v5 handles PKCE automatically. Never pass `client_secret` from any browser-based flow.

### Redirect URI type must be `spa` in portal

This is not optional for auth code flow. Using type "Web" breaks CORS at the token endpoint. Using type "spa" signals to Entra ID to allow cross-origin token requests without a secret.

### Offline_access scope and refresh token security

Requesting `offline_access` grants a refresh token. Refresh tokens are stored in the MSAL cache (localStorage or sessionStorage). In v5 with localStorage, they are encrypted at rest with AES-GCM. However:
- The encryption key is a session cookie — any attacker with access to the browser session can decrypt the cache
- The encryption is about **reducing persistence**, not blocking a local attacker
- **Primary defense is XSS prevention** — a script injected into the page can steal tokens before they hit storage

### XSS mitigation (most important security concern)

Token theft via XSS is the primary attack vector for SPA auth. Defenses:
1. **Content Security Policy (CSP)**: Set `Content-Security-Policy` header restricting script sources to your own origin only
2. **Sanitize all user-controlled content** before rendering (especially in To-do task display)
3. **No `eval()` or `innerHTML` with user data**
4. **Keep dependencies updated**: Use `npm audit` regularly; supply chain attacks target token theft
5. **Subresource Integrity (SRI)**: For any CDN-loaded scripts, use integrity hashes

### State and nonce validation

MSAL automatically generates and validates the `state` parameter (CSRF protection) and `nonce` (replay protection). Do not bypass or override these.

### Scope minimization

Request only the scopes you need. For To-do read/write: `Tasks.ReadWrite offline_access openid`. Do not request `User.ReadWrite.All` or other broad scopes — users see all requested permissions in the consent screen.

### One resource per token request

The Microsoft identity platform only issues tokens for one resource API per request. `Tasks.ReadWrite` is a Graph API scope — request it in a single call. If you later need scopes from a different resource (e.g., a custom API), make a separate `acquireTokenSilent` call for that resource.

### `offline_access` consent requirement

`offline_access` must be explicitly included in the `scope` array at login time to receive a refresh token. If omitted, MSAL will only receive a short-lived access token and will need interactive re-auth after 1 hour.

### Avoid token in URL / localStorage access from third-party scripts

- Never pass the access token as a URL query parameter
- If using third-party analytics or chat scripts, ensure they cannot access `localStorage` via `postMessage` exploits
- Prefer `sessionStorage` for higher-security deployments (at the cost of cross-tab session sharing)

### Token forwarding warning

When calling Microsoft Graph with the access token, use it only for Graph requests. Never forward or log the token value. The token represents the signed-in user's permissions.

---

## 8. Full Configuration Reference

```typescript
import {
    PublicClientApplication,
    BrowserCacheLocation,
    LogLevel,
} from "@azure/msal-browser";

export const msalConfig = {
    auth: {
        clientId: import.meta.env.VITE_MSAL_CLIENT_ID,       // From Azure portal
        authority: "https://login.microsoftonline.com/common", // common = work + personal accounts
        redirectUri: window.location.origin,                   // Must match portal registration
        postLogoutRedirectUri: window.location.origin,
        navigateToLoginRequestUrl: true,                       // Return to pre-auth URL after login
    },
    cache: {
        cacheLocation: BrowserCacheLocation.LocalStorage,
        storeAuthStateInCookie: false,                         // Only needed for IE11 (irrelevant now)
    },
    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) return;                       // Never log PII
                if (level === LogLevel.Error) console.error(message);
                if (level === LogLevel.Warning) console.warn(message);
                // Enable verbose only in dev
                if (import.meta.env.DEV && level === LogLevel.Verbose) console.log(message);
            },
            piiLoggingEnabled: false,                          // Never enable in production
        },
    },
};

// Scopes for To-do API access
export const todoLoginRequest = {
    scopes: [
        "openid",
        "offline_access",
        "https://graph.microsoft.com/Tasks.ReadWrite",
        "https://graph.microsoft.com/User.Read",
    ],
};
```

---

## 9. Sources

All findings are HIGH confidence — sourced directly from official Microsoft documentation.

- MSAL.js overview (versions, LTS table): https://learn.microsoft.com/en-us/javascript/api/overview/msal-overview
- MSAL Browser v5 overview: https://learn.microsoft.com/en-us/entra/msal/javascript/browser/about-msal-browser
- MSAL Browser initialization: https://learn.microsoft.com/en-us/entra/msal/javascript/browser/initialization
- MSAL Browser token acquisition: https://learn.microsoft.com/en-us/entra/msal/javascript/browser/acquire-token
- MSAL Browser caching: https://learn.microsoft.com/en-us/entra/msal/javascript/browser/caching
- MSAL Browser token lifetimes: https://learn.microsoft.com/en-us/entra/msal/javascript/browser/token-lifetimes
- MSAL Browser errors: https://learn.microsoft.com/en-us/entra/msal/javascript/browser/errors
- MSAL React getting started: https://learn.microsoft.com/en-us/entra/msal/javascript/react/getting-started
- SPA app code configuration: https://learn.microsoft.com/en-us/entra/identity-platform/scenario-spa-app-configuration
- App registration quickstart: https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app
- OAuth 2.0 Auth Code + PKCE flow reference: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
- Microsoft Graph Tasks permissions: https://learn.microsoft.com/en-us/graph/permissions-reference#tasks-permissions
