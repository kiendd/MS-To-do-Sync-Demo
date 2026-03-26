# Roadmap: MS To-do Sync Demo

## Overview

Four phases from zero to a daily-usable two-way task sync app. Phase 1 establishes auth and the project scaffold — nothing else can run without a valid Graph API token. Phase 2 builds the read path with delta sync as the architectural foundation, so the cache structure exists before writes are layered on. Phase 3 adds CRUD with optimistic updates on top of the working cache. Phase 4 validates end-to-end two-way sync with real usage, hardens the UX, and completes the responsive layout.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Azure App Registration + MSAL v5 auth + Vite/React/TS scaffold + one successful Graph API call
- [ ] **Phase 2: Core Data Layer** - Task lists and tasks read via delta sync, flaggedEmails list detection, TanStack Query + Zustand setup, 30-second polling
- [ ] **Phase 3: Write Operations** - CRUD tasks with optimistic updates and rollback, full mutation layer
- [ ] **Phase 4: Polish and Two-Way Sync** - End-to-end two-way sync validation, responsive UI with shadcn/ui, UX hardening

---

## Phase Details

### Phase 1: Foundation
**Goal**: The project scaffold is running locally and the user can sign in with a Microsoft account, acquire a Graph API access token, and see a successful response from at least one Graph endpoint. All auth pitfalls (wrong redirect URI type, missing `offline_access` scope, CORS errors) are resolved before any feature work begins.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02
**Success Criteria** (what must be TRUE):
  1. User can open the app in a browser and click "Sign in" — the Microsoft login popup appears and completes successfully
  2. After sign-in, the user's account name is displayed and the app shows an authenticated state
  3. User can sign out and the app returns to the unauthenticated state
  4. A raw call to `GET /me/todo/lists` returns a valid response (visible in the UI or browser console) — confirming token injection and CORS are working
  5. Closing and reopening the browser tab restores the session silently without requiring re-login (token persisted in localStorage, silent renewal via `acquireTokenSilent`)
**Plans**: 2 plans

Plans:
- [ ] 01-01: Azure App Registration + MSAL v5 scaffold — Register the Azure app as SPA type, scaffold Vite + React + TypeScript project, configure `MsalProvider` with correct scopes (`Tasks.ReadWrite openid offline_access`), implement `loginPopup` / `logoutPopup` flow and `AuthGuard`
- [ ] 01-02: Graph API client + token validation — Build the typed Graph API client wrapper (`acquireTokenSilent` + popup fallback, `429 Retry-After` handling, `@odata.nextLink` pagination loop), make a successful `GET /me/todo/lists` call, display account name to confirm auth is end-to-end working
**UI hint**: yes

---

### Phase 2: Core Data Layer
**Goal**: The app fetches all task lists and tasks from Microsoft Graph using delta query as the primary data mechanism. The Zustand sync store persists delta tokens across sessions. The 30-second polling loop is running and the flaggedEmails list is detected and its tasks are displayed inline.
**Depends on**: Phase 1
**Requirements**: LIST-01, LIST-02, TASK-01, SYNC-01, SYNC-03, UI-02
**Success Criteria** (what must be TRUE):
  1. The sidebar shows all of the user's Microsoft To-do lists fetched via delta query, and selecting a list displays its tasks in the main view
  2. Tasks from the "Flagged Email" list appear in the task list view alongside regular tasks (no separate section)
  3. After the initial full sync, the app uses the stored `deltaLink` on subsequent polls and only fetches changed tasks — confirmed by network requests containing `$deltatoken`
  4. With the tab visible, Graph is polled every 30 seconds; with the tab hidden, polling is paused
  5. When the app receives a `410 Gone` response for a stored delta token, it clears the token and performs a full re-sync, showing a "Re-syncing" indicator
  6. The sync status indicator shows the last-synced timestamp and updates after each poll cycle
**Plans**: 2 plans

Plans:
- [ ] 02-01: TanStack Query + Zustand setup + task list delta sync — Install and configure TanStack Query `QueryClient`, create Zustand sync store (`deltaLinks`, `lastSyncedAt`, `syncStatus` persisted to localStorage), implement `useTaskLists` query with `GET /me/todo/lists/delta`, render list sidebar, detect `wellknownListName: "flaggedEmails"` and cache list ID
- [ ] 02-02: Task delta sync loop + sync status UI — Implement `useTasks` query with `GET /me/todo/lists/{id}/tasks/delta` (full initial sync + `@odata.nextLink` pagination + `deltaLink` storage), configure `refetchInterval: 30_000` and `refetchIntervalInBackground: false`, handle `410 Gone` with full re-sync, build sync status indicator component showing last-synced time and sync state
**UI hint**: yes

---

### Phase 3: Write Operations
**Goal**: Users can create, edit, delete, and complete tasks. All writes are applied optimistically so the UI responds instantly, with automatic rollback and a toast notification on failure. The delta merge logic correctly handles partial task objects and prevents conflicts with locally pending edits.
**Depends on**: Phase 2
**Requirements**: TASK-02, TASK-03, TASK-04, TASK-05, SYNC-04
**Success Criteria** (what must be TRUE):
  1. User can type a task title and press Enter — the task appears in the list immediately (optimistic) and is confirmed via Graph within seconds
  2. User can click a task to edit its title, status, or importance — the change appears immediately and survives a page reload (persisted to Graph)
  3. User can delete a task — it disappears from the list immediately; if the Graph call fails, the task reappears with an error toast
  4. User can check a task complete — it is visually marked done immediately; unchecking restores it; both states sync to MS To-do
  5. If a write fails (network error, 429), the UI rolls back to the pre-edit state and displays a toast notification with the error
**Plans**: 2 plans

Plans:
- [ ] 03-01: Create and delete task mutations — Implement `useCreateTask` (`POST`) with `tmp-{uuid}` optimistic ID and deduplication on server response, implement `useDeleteTask` (`DELETE`) with optimistic removal and rollback, wire up AddTaskForm component and delete action in task list
- [ ] 03-02: Edit, complete, and conflict guard — Implement `useUpdateTask` (`PATCH`) and `useCompleteTask` (status toggle via PATCH), build task edit UI (inline or modal), add `toGraphDateTime()` helper for any date fields, implement `lastModifiedDateTime` conflict guard in delta merge to prevent server update from overwriting a locally pending edit, add toast notification system for write failures
**UI hint**: yes

---

### Phase 4: Polish and Two-Way Sync
**Goal**: End-to-end two-way sync is validated with real usage across both the web app and the native MS To-do or Outlook clients. The app is responsive on mobile and tablet. UX edge cases (empty states, loading skeletons, error boundaries, 24-hour token renewal) are handled gracefully so the app is usable as a daily driver.
**Depends on**: Phase 3
**Requirements**: SYNC-02, UI-01, UI-03
**Success Criteria** (what must be TRUE):
  1. A task created or edited in the native MS To-do app (or Outlook) appears in the web app within one poll cycle (up to 30 seconds) without a manual refresh
  2. Flagging an email in Outlook causes a task to appear in the web app within one poll cycle, with a visible "From Outlook" badge on the task
  3. A task completed in the web app is marked complete in the native MS To-do app (visible after opening MS To-do)
  4. After 24+ hours of continuous use, the app silently renews the session; if renewal requires user interaction (`InteractionRequiredAuthError`), a login popup appears and sync resumes without data loss
  5. The app is usable on a mobile screen (320px+) — lists and tasks are readable and all actions are tappable
  6. Empty states (no lists, no tasks, loading) and error boundaries are shown instead of blank screens or crashes
**Plans**: 2 plans

Plans:
- [ ] 04-01: Two-way sync validation + token renewal hardening — Test full two-way sync cycle (app-to-Graph and Graph-to-app), validate `410 Gone` recovery with an expired delta token, test 24-hour session and `InteractionRequiredAuthError` popup flow, apply `$select` to delta queries to reduce payload size, add `$expand=linkedResources` to task queries for flagged email detection
- [ ] 04-02: Responsive layout + UX hardening — Implement responsive layout for mobile/tablet using Tailwind breakpoints and shadcn/ui components, add Outlook origin badge to flagged email tasks (using `linkedResources[].applicationName`), build loading skeletons for task list and sidebar, add empty state components, add React error boundaries, final visual polish
**UI hint**: yes

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/2 | Not started | - |
| 2. Core Data Layer | 0/2 | Not started | - |
| 3. Write Operations | 0/2 | Not started | - |
| 4. Polish and Two-Way Sync | 0/2 | Not started | - |
