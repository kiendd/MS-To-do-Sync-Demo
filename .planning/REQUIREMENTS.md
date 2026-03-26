# Requirements: MS To-do Sync Demo

## Summary

| Category | v1 Count | v2 Count |
|----------|----------|----------|
| AUTH | 2 | 0 |
| LIST | 2 | 0 |
| TASK | 5 | 1 |
| SYNC | 4 | 1 |
| UI | 3 | 2 |
| **Total** | **16** | **4** |

---

## v1 Requirements (In Scope — Build This)

### AUTH — Authentication

**AUTH-01**: User can sign in with a Microsoft account via OAuth2 Authorization Code + PKCE using MSAL v5 (`@azure/msal-browser` + `@azure/msal-react`). Azure App Registration must be configured as Single-page Application type with scopes `Tasks.ReadWrite openid offline_access`.

**AUTH-02**: Access tokens are renewed silently via `acquireTokenSilent` before each Graph API call. When silent renewal fails (`InteractionRequiredAuthError`), user is prompted with a popup. User can sign out from the app.

---

### LIST — Task List Management

**LIST-01**: The sidebar displays all of the user's Microsoft To-do lists fetched via `GET /me/todo/lists/delta`. User can select a list to view its tasks.

**LIST-02**: The "Flagged Email" list (`wellknownListName: "flaggedEmails"`) is detected at runtime by filtering `GET /me/todo/lists` results. Its list ID is cached. Tasks from this list appear inline in the regular task list view with a visual Outlook origin badge — not in a separate section.

---

### TASK — Task CRUD

**TASK-01**: Tasks for the selected list are fetched via `GET /me/todo/lists/{id}/tasks/delta` (full initial sync followed by incremental delta). Task properties displayed: title, status (complete/incomplete), importance.

**TASK-02**: User can create a new task in the currently selected list. Task is added optimistically to the UI before the `POST /me/todo/lists/{id}/tasks` response returns.

**TASK-03**: User can edit a task's title, status (`notStarted` / `inProgress`), and importance (`low` / `normal` / `high`) via `PATCH`. Change is applied optimistically.

**TASK-04**: User can delete a task. Task is removed from the UI optimistically before the `DELETE` response returns.

**TASK-05**: User can mark a task complete or incomplete. Status is toggled via `PATCH` with `status: "completed"` or `status: "notStarted"`. Change is applied optimistically.

---

### SYNC — Synchronization

**SYNC-01**: The app polls the Graph delta endpoint every 30 seconds while the browser tab is visible (`refetchInterval: 30_000`, `refetchIntervalInBackground: false`). The full `@odata.deltaLink` URL is stored to `localStorage` via Zustand and reused on subsequent polls. Only changed tasks are fetched after the initial sync.

**SYNC-02**: Changes made in the native Microsoft To-do app or Outlook (including flagging an email) appear in the web app within one poll cycle (up to 30 seconds). Changes made in the web app are reflected in Microsoft To-do via the Graph write operations.

**SYNC-03**: When Graph returns `410 Gone` for a stored delta token, the app discards the token, clears the task cache, performs a full re-sync, and shows a "Re-syncing" indicator to the user.

**SYNC-04**: All write operations (create, edit, delete, complete) use TanStack Query `useMutation` with `onMutate` (optimistic apply) / `onError` (rollback + toast notification) / `onSettled` (cache invalidation) lifecycle. A `lastModifiedDateTime` guard prevents a server delta update from overwriting a locally pending edit that is newer.

---

### UI — Interface

**UI-01**: The web app layout is responsive and usable on mobile and tablet screen sizes. The app can be used as a daily task manager.

**UI-02**: A sync status indicator shows the last-synced timestamp and current state (`idle` / `syncing` / `error`). This is driven by the Zustand sync store `syncStatus` field.

**UI-03**: Tasks originating from Outlook flagged emails display a visible badge or label indicating their Outlook origin (e.g., "From Outlook"). This uses the `linkedResources` navigation property (`$expand=linkedResources`) to detect the source.

---

## v2 Requirements (Deferred — Not This Milestone)

**TASK-06**: User can set and edit a due date on a task. Uses the `dateTimeTimeZone` object format `{ dateTime, timeZone }` required by the Graph API.

**SYNC-05**: Flagged email tasks created by flagging an email in Outlook display a clickable link back to the source email using `linkedResources[].webUrl`.

**UI-04**: Dark mode support via the shadcn/ui `ThemeProvider` pattern with a toggle in the UI.

**UI-05**: Drag-and-drop task reordering within a list using `@dnd-kit/sortable`. Requires computing a new `orderDateTime` value between adjacent tasks — deferred due to non-trivial API behavior.

---

## Out of Scope

| Item | Reason |
|------|--------|
| Mobile native app | Web SPA is sufficient for demo |
| Multi-user / task sharing | Personal app only |
| Offline mode (queued writes) | Connectivity required for sync |
| Backend server | Pure client-side SPA |
| Due date / reminders (v1) | Not selected for first milestone — deferred to v2 |
| Subtask (checklistItems) display | Not in core scope |
| Drag-and-drop (v1) | `orderDateTime` arithmetic is non-trivial — deferred to v2 |
| Change notifications / webhooks | Require a public HTTPS backend endpoint |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Pending |
| LIST-01 | Phase 2 | Complete |
| LIST-02 | Phase 2 | Complete |
| TASK-01 | Phase 2 | Complete |
| SYNC-01 | Phase 2 | Complete |
| SYNC-03 | Phase 2 | Complete |
| UI-02 | Phase 2 | Complete |
| TASK-02 | Phase 3 | Complete |
| TASK-03 | Phase 3 | Complete |
| TASK-04 | Phase 3 | Complete |
| TASK-05 | Phase 3 | Complete |
| SYNC-04 | Phase 3 | Complete |
| SYNC-02 | Phase 4 | Pending |
| UI-01 | Phase 4 | Pending |
| UI-03 | Phase 4 | Pending |
