---
phase: 02-core-data-layer
plan: 01
subsystem: data-layer
tags: [tanstack-query, zustand, delta-sync, task-lists, sidebar]
dependency_graph:
  requires: [01-01-SUMMARY, graph-client]
  provides: [query-client, sync-store, task-lists-delta-hook, task-list-sidebar]
  affects: [02-02]
tech_stack:
  added:
    - "@tanstack/react-query (QueryClient with 30s staleTime, QueryClientProvider)"
    - "zustand persist middleware (localStorage key: ms-todo-sync-store)"
  patterns:
    - "Delta query pagination loop (nextLink until deltaLink on last page)"
    - "Zustand getState() inside TanStack Query queryFn (outside React)"
    - "Delta merge map pattern for incremental sync (handle @removed)"
    - "410 Gone detection via error.code GoneError with automatic full-resync"
    - "flaggedEmails detection via wellknownListName on every sync"
key_files:
  created:
    - src/features/graph/client.ts
    - src/features/graph/types.ts
    - src/features/graph/index.ts
    - src/app/queryClient.ts
    - src/stores/sync.store.ts
    - src/features/task-lists/api/taskLists.api.ts
    - src/features/task-lists/hooks/useTaskLists.ts
    - src/features/task-lists/components/TaskListSidebar.tsx
    - src/features/task-lists/components/TaskListItem.tsx
    - src/features/task-lists/index.ts
  modified:
    - src/main.tsx
    - src/App.tsx
decisions:
  - "Used graphFetch (not graphFetchAll) in fetchTaskListsDelta for fine-grained pagination control — delta queries need explicit loop to capture deltaLink from last page only"
  - "Zustand getState() (not useStore hook) inside queryFn — recommended pattern for Zustand outside React component tree"
  - "syncStatus excluded from persist partialize — should reset to idle on fresh load, not stuck in syncing"
  - "flaggedEmailsListId persisted to avoid re-scanning on every load, but updated on every sync to keep current"
metrics:
  duration: "8 minutes"
  completed: "2026-03-26"
  tasks_completed: 2
  files_created: 10
  files_modified: 2
---

# Phase 02 Plan 01: TanStack Query + Zustand Sync Store + Task Lists Delta Sync Summary

**One-liner:** TanStack Query v5 QueryClient (30s staleTime) + Zustand persist store (localStorage) + delta query hook for task lists with pagination, merge, 410 recovery, and flaggedEmails detection.

## What Was Built

- **Graph client** (`src/features/graph/`): `graphFetch` (single-page, 429 retry, 410 GoneError, auth) and `graphFetchAll` (full pagination) — prerequisite not yet committed from Plan 01-02
- **QueryClient** (`src/app/queryClient.ts`): singleton with 30s staleTime, 1 retry, refetchOnWindowFocus
- **Zustand sync store** (`src/stores/sync.store.ts`): persists listsDeltaLink, tasksDeltaLinks (per-list), selectedListId, flaggedEmailsListId, lastSyncedAt to localStorage key `ms-todo-sync-store`; syncStatus excluded from persistence
- **Delta API function** (`fetchTaskListsDelta`): paginates all nextLink pages, captures deltaLink only from the final page
- **useTaskLists hook**: TanStack Query wrapping delta sync — initial sync replaces cache, incremental sync merges via Map (handles @removed), 410 triggers full resync with status "resyncing", auto-selects first list, detects flaggedEmails list
- **Sidebar UI**: TaskListSidebar with loading skeleton + error state + list rendering; TaskListItem with Mail icon for flaggedEmails and isSelected highlight via cn()
- **App layout**: Updated App.tsx to flex layout with sidebar + main content area (authenticated-only via AuthGuard)
- **main.tsx**: QueryClientProvider wired inside MsalProvider

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| graphFetch (not graphFetchAll) in delta API | Delta queries need explicit loop — deltaLink only appears on the last page; graphFetchAll doesn't distinguish nextLink vs deltaLink phases cleanly |
| useSyncStore.getState() in queryFn | Zustand recommended pattern for accessing store outside React tree — hooks cannot be called inside queryFn |
| syncStatus excluded from persist | Prevents "stuck in syncing" state after page refresh |
| flaggedEmailsListId persisted | Avoids re-scanning all lists on every load; still updated on every sync to handle list additions/removals |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Graph client (Plan 01-02) not yet created**
- **Found during:** Pre-execution — `src/features/graph/` directory did not exist
- **Issue:** Plan 02-01 depends on `graphFetch` from `src/features/graph/client.ts`. Plan 01-02 was planned but its tasks were not committed (the plan ended at a human-verify checkpoint that was not yet reached).
- **Fix:** Created the full graph client (`client.ts`, `types.ts`, `index.ts`) matching the interface spec in Plan 01-02 before proceeding with Plan 02-01 tasks.
- **Files created:** src/features/graph/client.ts, src/features/graph/types.ts, src/features/graph/index.ts
- **Commit:** fea0687

**2. [Rule 1 - Bug] TypeScript TS7022 implicit any on await in while loop**
- **Found during:** Task 1 and Task 2 — TypeScript strict mode reports implicit any when a variable both holds the awaited result and is referenced in the type parameter
- **Fix:** Added explicit type annotation to the response variable in both `graphFetchAll` and `fetchTaskListsDelta` pagination loops (`const page: GraphPagedResponse<T> = await ...`)
- **Files modified:** src/features/graph/client.ts, src/features/task-lists/api/taskLists.api.ts
- **Commit:** fea0687, 17a6cec

## Known Stubs

- `src/App.tsx` main area shows "Tasks for list {selectedListId} will be displayed here (Plan 02-02)." — intentional placeholder, resolved by Plan 02-02

## Verification Results

All plan verification checks passed:

- `npm run build` exits with code 0
- `npx tsc --noEmit` exits with code 0
- `grep QueryClientProvider src/main.tsx` matches
- `grep ms-todo-sync-store src/stores/sync.store.ts` matches
- `grep listsDeltaLink src/stores/sync.store.ts` matches
- `grep /me/todo/lists/delta src/features/task-lists/api/taskLists.api.ts` matches
- `grep wellknownListName.*flaggedEmails src/features/task-lists/hooks/useTaskLists.ts` matches
- `grep setFlaggedEmailsListId src/features/task-lists/hooks/useTaskLists.ts` matches
- `grep @removed src/features/task-lists/hooks/useTaskLists.ts` matches
- `grep TaskListSidebar src/App.tsx` matches

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 + Rule 3 fix | fea0687 | feat(02-core-data-layer-01): install QueryClient, Zustand sync store, and graph client |
| Task 2 | 17a6cec | feat(02-core-data-layer-01): implement task lists delta sync hook and sidebar UI |

## Self-Check: PASSED
