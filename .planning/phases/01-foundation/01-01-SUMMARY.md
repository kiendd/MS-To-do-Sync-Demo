---
phase: 01-foundation
plan: 01
subsystem: auth
tags: [vite, react, typescript, msal, tailwind, shadcn, auth]
dependency_graph:
  requires: []
  provides: [project-scaffold, msal-auth, auth-guard, graph-token-hook]
  affects: [01-02]
tech_stack:
  added:
    - "@azure/msal-browser@5.x"
    - "@azure/msal-react@5.x"
    - "@tanstack/react-query@5.x"
    - "zustand@5.x"
    - "lucide-react"
    - "tailwindcss@4.x (via @tailwindcss/vite)"
    - "shadcn/ui (base-nova style)"
    - "@microsoft/microsoft-graph-types (dev)"
    - "@base-ui/react (shadcn button dependency)"
    - "class-variance-authority, clsx, tailwind-merge"
  patterns:
    - "MSAL PublicClientApplication singleton outside component tree"
    - "MsalProvider wrapping entire app"
    - "acquireTokenSilent with InteractionRequiredAuthError popup fallback"
    - "AuthenticatedTemplate/UnauthenticatedTemplate for auth gating"
    - "Feature-collocated folder structure (src/features/auth/)"
    - "@/* path alias for imports"
key_files:
  created:
    - src/config/msal.ts
    - src/config/scopes.ts
    - src/features/auth/components/LoginButton.tsx
    - src/features/auth/components/AuthGuard.tsx
    - src/features/auth/hooks/useGraphToken.ts
    - src/features/auth/index.ts
    - src/shared/components/ui/button.tsx
    - src/shared/lib/utils.ts
    - .env.example
  modified:
    - src/main.tsx
    - src/App.tsx
    - src/App.css
    - src/index.css
    - vite.config.ts
    - tsconfig.json
    - tsconfig.app.json
    - components.json
    - package.json
decisions:
  - "Used Tailwind v4 with @tailwindcss/vite plugin (not v3) — shadcn@4 requires v4"
  - "Removed tailwind.config.js and postcss.config.js — not needed with Tailwind v4 Vite plugin"
  - "Placed shadcn components in src/shared/components/ui/ per feature-collocated structure"
  - "Added @/* path alias to both tsconfig.json root (for shadcn detection) and tsconfig.app.json (for compilation)"
  - "Used shadcn base-nova style (default for shadcn@4)"
metrics:
  duration: "6 minutes"
  completed: "2026-03-26"
  tasks_completed: 2
  files_created: 9
  files_modified: 9
---

# Phase 01 Plan 01: Vite + React + TS Scaffold with MSAL v5 Auth Summary

**One-liner:** Vite 8 + React 18 + TypeScript scaffold with MSAL v5 popup auth (Tasks.ReadWrite scopes, localStorage cache, AuthGuard) using Tailwind v4 + shadcn/ui base-nova.

## What Was Built

A complete React SPA scaffold with working Microsoft sign-in/sign-out authentication:

- **Project scaffold**: Vite 8 + React 18 + TypeScript with `@/*` path alias, Tailwind v4 via `@tailwindcss/vite` plugin, shadcn/ui with components in `src/shared/`
- **MSAL configuration**: `PublicClientApplication` singleton with `authority=common` (personal + work accounts), `BrowserCacheLocation.LocalStorage`, PII-safe logger
- **Scope constants**: `GRAPH_SCOPES` (Tasks.ReadWrite, User.Read), `LOGIN_REQUEST` (with openid + offline_access), `TOKEN_REQUEST`
- **Authentication flow**: `LoginButton` with `loginPopup` + `setActiveAccount` and `logoutPopup`; `AuthGuard` using MSAL's `AuthenticatedTemplate`/`UnauthenticatedTemplate`
- **Token hook**: `useGraphToken` with `acquireTokenSilent` → `InteractionRequiredAuthError` → `acquireTokenPopup` fallback
- **App wiring**: `MsalProvider` wrapping app in `main.tsx`, `AuthGuard` gates the main content

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Tailwind v4 over v3 | shadcn@4 CLI requires Tailwind v4; removed postcss.config.js and tailwind.config.js (not needed with Vite plugin) |
| Components in src/shared/ | Matches feature-collocated structure from frontend-stack.md research |
| Path alias in root tsconfig.json | shadcn@4 CLI reads the root tsconfig for alias detection; tsconfig.app.json also updated for compilation |
| shadcn base-nova style | Default for shadcn@4; clean neutral palette suited to productivity app |
| localStorage cache | Users expect cross-tab session persistence for a daily-use task app; AES-GCM encryption in MSAL v5 mitigates security concerns |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn@4 requires Tailwind v4, not v3**
- **Found during:** Task 1 — shadcn@4 CLI failed validation when Tailwind v3 was installed
- **Issue:** The plan suggested `tailwindcss init -p` (Tailwind v3 approach). shadcn@4 (`shadcn@4.1.0`) requires Tailwind v4 and the `@tailwindcss/vite` plugin.
- **Fix:** Uninstalled Tailwind v3 + autoprefixer + postcss, installed `tailwindcss@4.x + @tailwindcss/vite`. Removed `postcss.config.js` and `tailwind.config.js`. Updated `vite.config.ts` to use `tailwindcss()` Vite plugin. Updated `src/index.css` to use `@import "tailwindcss"` (Tailwind v4 syntax).
- **Files modified:** vite.config.ts, src/index.css, package.json
- **Commit:** 3f8de91

**2. [Rule 3 - Blocking] shadcn@4 CLI needs path alias in root tsconfig.json**
- **Found during:** Task 1 — shadcn init failed with "No import alias found in your tsconfig.json file"
- **Issue:** The Vite scaffold puts `compilerOptions` only in `tsconfig.app.json` (referenced project). shadcn@4 reads the root `tsconfig.json` for alias detection.
- **Fix:** Added `compilerOptions.paths` with `@/*` to the root `tsconfig.json` in addition to `tsconfig.app.json`. Also added `baseUrl`.
- **Files modified:** tsconfig.json, tsconfig.app.json
- **Commit:** 3f8de91

**3. [Rule 1 - Bug] shadcn@4 placed utils at @/lib/utils but button imports @/lib/utils after relocation**
- **Found during:** Task 1 — After moving components to src/shared/, button.tsx still imported from `@/lib/utils`
- **Fix:** Updated `button.tsx` import to `@/shared/lib/utils` to match the new path.
- **Files modified:** src/shared/components/ui/button.tsx
- **Commit:** 3f8de91

## Known Stubs

None — the auth implementation is complete. The `.env.local` placeholder `VITE_MSAL_CLIENT_ID=YOUR_CLIENT_ID_HERE` is intentional and documented in the plan's `user_setup` section (requires Azure App Registration).

## Verification Results

All plan verification checks passed:

- `npm run build` exits with code 0
- `npx tsc --noEmit` exits with code 0
- `offline_access` present in src/config/scopes.ts LOGIN_REQUEST
- `BrowserCacheLocation.LocalStorage` present in src/config/msal.ts
- `acquireTokenSilent` and `InteractionRequiredAuthError` present in useGraphToken.ts
- `MsalProvider` and `msalInstance` present in src/main.tsx
- `AuthenticatedTemplate` and `UnauthenticatedTemplate` present in AuthGuard.tsx

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 3f8de91 | feat(01-foundation-01): scaffold Vite + React + TS project with all dependencies |
| Task 2 | 5fa751c | feat(01-foundation-01): configure MSAL v5 and implement login/logout/AuthGuard |

## Self-Check: PASSED
