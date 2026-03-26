---
phase: 02-core-data-layer
verified: 2026-03-26T00:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Confirm sidebar loads and displays real MS To-do lists after login"
    expected: "All lists visible in sidebar; selecting a list shows its tasks in main view"
    why_human: "Requires live Microsoft Graph credentials and browser session"
  - test: "Confirm 30-second polling fires network requests containing $deltatoken"
    expected: "After initial full sync, subsequent Graph calls contain $deltatoken query param in URL"
    why_human: "Requires live session and network tab inspection"
  - test: "Confirm tab visibility pauses polling"
    expected: "No Graph requests fire while tab is hidden; requests resume when tab regains focus"
    why_human: "Requires browser interaction; refetchIntervalInBackground=false is correctly set in code"
  - test: "Confirm 410 Gone recovery shows Re-syncing indicator"
    expected: "Simulating a 410 error clears delta token, triggers full re-sync, shows Re-syncing text in status bar"
    why_human: "Requires simulated error injection or expired token; code path is correctly implemented"
---

# Phase 02: Core Data Layer Verification Report

**Phase Goal:** The app fetches all task lists and tasks from Microsoft Graph using delta query as the primary data mechanism. The Zustand sync store persists delta tokens across sessions. The 30-second polling loop is running and the flaggedEmails list is detected and its tasks are displayed inline.
**Verified:** 2026-03-26
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sidebar shows all MS To-do lists fetched via delta query | VERIFIED | `TaskListSidebar` calls `useTaskLists` which calls `fetchTaskListsDelta` hitting `/me/todo/lists/delta` |
| 2 | Tasks from flaggedEmails list appear inline with Outlook badge (no separate section) | VERIFIED | `TaskItem` renders `isFromFlaggedEmails` badge inline; `TaskList` determines flag by `listId === flaggedEmailsListId` |
| 3 | After initial sync, subsequent polls use stored deltaLink (only changes fetched) | VERIFIED | `useTasks` reads `tasksDeltaLinks[listId]` from Zustand; uses it as URL if non-null; `useTaskLists` does same for `listsDeltaLink` |
| 4 | Tab visible: Graph polled every 30s; tab hidden: polling paused | VERIFIED | `useTasks` has `refetchInterval: 30_000` and `refetchIntervalInBackground: false` at lines 99-100 |
| 5 | 410 Gone response clears delta token, triggers full re-sync, shows Re-syncing indicator | VERIFIED | Both `useTasks` (line 78) and `useTaskLists` (line 73) catch 410/GoneError, call `clearTasksDeltaLink`/`setListsDeltaLink(null)`, set `syncStatus: "resyncing"`, retry with null deltaLink |
| 6 | Sync status indicator shows last-synced timestamp and updates after each poll | VERIFIED | `SyncStatusBar` reads `syncStatus` and `lastSyncedAt` from Zustand; `formatRelativeTime` renders relative timestamp; both hooks call `setLastSyncedAt(Date.now())` after each successful poll |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/app/queryClient.ts` | VERIFIED | 11 lines; contains `QueryClient`, `staleTime: 30_000`, `refetchOnWindowFocus: true` |
| `src/stores/sync.store.ts` | VERIFIED | 71 lines; contains `listsDeltaLink`, `tasksDeltaLinks`, `flaggedEmailsListId`, `syncStatus`, `persist` middleware, `name: "ms-todo-sync-store"`, `partialize` excluding `syncStatus` |
| `src/features/task-lists/api/taskLists.api.ts` | VERIFIED | 37 lines; contains `/me/todo/lists/delta`, `@odata.nextLink` pagination loop, `@odata.deltaLink` capture from final page |
| `src/features/task-lists/hooks/useTaskLists.ts` | VERIFIED | 107 lines; contains `useQuery`, `useSyncStore.getState()`, `wellknownListName === "flaggedEmails"`, `setFlaggedEmailsListId`, 410 handling, `@removed` merge |
| `src/features/task-lists/components/TaskListSidebar.tsx` | VERIFIED | Renders `TaskListItem` list, reads `selectedListId` and `setSelectedListId` from `useSyncStore`, loading skeleton and error states |
| `src/features/tasks/api/tasks.api.ts` | VERIFIED | 47 lines; contains `/me/todo/lists/${listId}/tasks/delta`, pagination loop, `@removed` detection populating `removedIds` |
| `src/features/tasks/hooks/useTasks.ts` | VERIFIED | 102 lines; `refetchInterval: 30_000`, `refetchIntervalInBackground: false`, `useSyncStore.getState()`, `setTasksDeltaLink`, `clearTasksDeltaLink` in 410 handler, `setSyncStatus("resyncing")`, shallow merge `{ ...existing, ...task }` |
| `src/features/tasks/components/TaskList.tsx` | VERIFIED | 52 lines; calls `useTasks(listId)`, reads `flaggedEmailsListId` from Zustand, passes `isFromFlaggedEmails` to each `TaskItem` |
| `src/features/tasks/components/TaskItem.tsx` | VERIFIED | 53 lines; `isFromFlaggedEmails` prop, "Outlook" badge with `Mail` icon, `status === "completed"` line-through, `importance === "high"` star icon |
| `src/features/sync/components/SyncStatusBar.tsx` | VERIFIED | 49 lines; reads `syncStatus` and `lastSyncedAt`, `formatRelativeTime` with "Just now", "Re-syncing..." text, `animate-spin` on syncing/resyncing icons |

---

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `src/main.tsx` | `src/app/queryClient.ts` | `QueryClientProvider` wrapping App inside `MsalProvider` | WIRED |
| `src/features/task-lists/hooks/useTaskLists.ts` | `src/stores/sync.store.ts` | `useSyncStore.getState()` reads/writes `listsDeltaLink`, `flaggedEmailsListId`, `syncStatus`, `lastSyncedAt` | WIRED |
| `src/features/task-lists/hooks/useTaskLists.ts` | `src/features/graph/client.ts` | `graphFetch` called inside `fetchTaskListsDelta` (via `taskLists.api.ts`) | WIRED |
| `src/features/task-lists/components/TaskListSidebar.tsx` | `src/stores/sync.store.ts` | `useSyncStore` selects `selectedListId` and `setSelectedListId` | WIRED |
| `src/features/tasks/hooks/useTasks.ts` | `src/stores/sync.store.ts` | `useSyncStore.getState()` reads `tasksDeltaLinks[listId]`, writes via `setTasksDeltaLink`, `clearTasksDeltaLink`, `setSyncStatus`, `setLastSyncedAt` | WIRED |
| `src/features/tasks/hooks/useTasks.ts` | `@tanstack/react-query` | `useQuery` with `refetchInterval: 30_000` and `refetchIntervalInBackground: false` | WIRED |
| `src/features/sync/components/SyncStatusBar.tsx` | `src/stores/sync.store.ts` | `useSyncStore` selects `syncStatus` and `lastSyncedAt` | WIRED |
| `src/App.tsx` | `src/features/tasks/components/TaskList.tsx` | `<TaskList listId={selectedListId} />` in main content area | WIRED |
| `src/App.tsx` | `src/features/sync/components/SyncStatusBar.tsx` | `<SyncStatusBar />` at bottom of layout | WIRED |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `TaskListSidebar` | `taskLists` from `useTaskLists` | `fetchTaskListsDelta` → `graphFetch("/me/todo/lists/delta", getToken)` → live Graph API | Yes — live authenticated HTTP request | FLOWING |
| `TaskList` | `tasks` from `useTasks(listId)` | `fetchTasksDelta` → `graphFetch("/me/todo/lists/${listId}/tasks/delta", getToken)` → live Graph API | Yes — live authenticated HTTP request | FLOWING |
| `SyncStatusBar` | `lastSyncedAt`, `syncStatus` | Written by `useTasks` and `useTaskLists` after each successful poll via `setLastSyncedAt(Date.now())` and `setSyncStatus("idle")` | Yes — updated on real poll completion | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Check | Status |
|----------|-------|--------|
| TypeScript compiles | `npx tsc --noEmit` | PASS — zero errors |
| Vite build succeeds | `npm run build` | PASS — 497 kB bundle, built in 190ms |
| `refetchInterval` set to 30s | Pattern in `useTasks.ts` line 99 | PASS — `refetchInterval: 30_000` |
| `refetchIntervalInBackground` is false | Pattern in `useTasks.ts` line 100 | PASS — `refetchIntervalInBackground: false` |
| Delta URL used on incremental sync | `store.tasksDeltaLinks[listId] ?? null` as fetch URL | PASS — non-null delta link used as opaque URL, bypassing initial endpoint |
| 410 handler clears token | `clearTasksDeltaLink` call in catch block | PASS — present in both `useTasks` and `useTaskLists` |

---

### Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| LIST-01 | 02-01 | Sidebar shows all lists via `/me/todo/lists/delta`; selecting shows tasks | SATISFIED | `TaskListSidebar` + `useTaskLists` + `/me/todo/lists/delta` endpoint + `selectedListId` Zustand state wired to `TaskList` render |
| LIST-02 | 02-01, 02-02 | flaggedEmails detected; tasks appear inline with Outlook badge | SATISFIED | `wellknownListName === "flaggedEmails"` detection in `useTaskLists`; `isFromFlaggedEmails` badge in `TaskItem`; no separate section — all tasks in same `TaskList` component |
| TASK-01 | 02-02 | Tasks fetched via delta; title, status, importance displayed | SATISFIED | `/me/todo/lists/${listId}/tasks/delta` in `tasks.api.ts`; `TaskItem` renders title, Circle/CheckCircle2 status icon, Star for high importance |
| SYNC-01 | 02-01, 02-02 | 30s polling while visible; delta link persisted to localStorage; only changes after initial sync | SATISFIED | `refetchInterval: 30_000`, `refetchIntervalInBackground: false`; Zustand `persist` with `name: "ms-todo-sync-store"`; delta merge logic in both hooks |
| SYNC-03 | 02-01, 02-02 | 410 Gone: discard token, full re-sync, show Re-syncing indicator | SATISFIED | 410 catch blocks in `useTaskLists` and `useTasks`; `setSyncStatus("resyncing")`; `SyncStatusBar` renders "Re-syncing..." for that state |
| UI-02 | 02-02 | Sync status indicator with last-synced timestamp and state | SATISFIED | `SyncStatusBar` component reads `syncStatus` + `lastSyncedAt`; `formatRelativeTime` gives human-readable timestamp; idle/syncing/resyncing/error states all handled |

All 6 requirements satisfied. No orphaned requirements detected.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `App.tsx` line 23 | `<p className="text-muted-foreground">Select a list to view tasks</p>` — empty state text | Info | Not a stub — this is a legitimate empty state when no list is selected. `TaskList` is conditionally rendered only when `selectedListId` is non-null. |
| `useTasks.ts` line 14 | `if (!listId) return []` — early return of empty array | Info | Not a stub — guard clause for when `listId` is null; `enabled: !!listId` prevents this branch from executing in practice. |

No blockers or warnings found.

---

### Human Verification Required

#### 1. Live List Fetch

**Test:** Log in with a Microsoft account that has multiple To-do lists. Observe the sidebar.
**Expected:** All lists appear in the sidebar within a few seconds. Selecting a list loads its tasks in the main area.
**Why human:** Requires live Graph credentials; cannot mock in static analysis.

#### 2. Delta Token on Subsequent Poll

**Test:** After initial load, wait 30 seconds and open the browser Network tab. Observe the next Graph request URL.
**Expected:** The URL contains `$deltatoken=` as a query parameter, confirming the stored delta link is being reused.
**Why human:** Requires live session and network inspection; polling behavior cannot be verified statically.

#### 3. Tab Visibility Pause

**Test:** With the app loaded, switch to a different browser tab for 60+ seconds, then switch back. Observe Network tab.
**Expected:** No Graph requests fire while the tab is hidden; a request fires shortly after returning to the tab.
**Why human:** Requires browser interaction; `refetchIntervalInBackground: false` is correctly coded but runtime behavior requires a browser.

#### 4. 410 Gone Recovery

**Test:** Clear localStorage to invalidate a stored delta token, or wait for a token to expire, then reload.
**Expected:** The sync status bar shows "Re-syncing..." briefly, then transitions to "Synced just now" after the full re-sync completes.
**Why human:** Requires a 410 response from Graph (expired token or simulated error); code path is correctly implemented.

---

### Summary

Phase 02 goal is fully achieved. All 6 success criteria are implemented and verified against the actual codebase:

1. The sidebar renders lists from `/me/todo/lists/delta` via `useTaskLists` → `fetchTaskListsDelta` → `graphFetch`. List selection is wired through Zustand `selectedListId` to `TaskList`.

2. The flaggedEmails list is detected by `wellknownListName === "flaggedEmails"` in `useTaskLists`, its ID is stored in `flaggedEmailsListId`, and `TaskItem` renders the Outlook badge inline — no separate section.

3. Delta links are persisted to localStorage via Zustand `persist` middleware (`ms-todo-sync-store`). Both `useTaskLists` and `useTasks` read the stored delta link before each fetch and use it as the opaque URL if non-null.

4. `useTasks` has `refetchInterval: 30_000` and `refetchIntervalInBackground: false`, giving 30-second polling that pauses when the tab is hidden.

5. Both hooks have 410 Gone catch blocks that clear the relevant delta token, set `syncStatus: "resyncing"`, retry the full sync, then restore to `"idle"`. `SyncStatusBar` renders "Re-syncing..." during this state.

6. `SyncStatusBar` reads `syncStatus` and `lastSyncedAt` from Zustand and displays a human-readable relative timestamp. Both hooks call `setLastSyncedAt(Date.now())` after every successful poll.

TypeScript compiles with zero errors. Vite build succeeds.

---

_Verified: 2026-03-26_
_Verifier: Claude (gsd-verifier)_
