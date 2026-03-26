---
phase: 03-write-operations
plan: 02
subsystem: tasks-mutations
tags: [tanstack-query, optimistic-updates, mutations, update, complete, conflict-guard, sonner, toast, inline-edit]
dependency_graph:
  requires: [03-01-SUMMARY, useCreateTask, useDeleteTask, tasks-delta-hook, sync-store, graph-client, auth-hook]
  provides: [useUpdateTask, useCompleteTask, updateTask-api, toGraphDateTime, pendingMutations-conflict-guard, TaskItem-inline-edit, Toaster]
  affects: [04-01-two-way-sync-validation]
tech_stack:
  added: []
  patterns:
    - "Optimistic PATCH with full snapshot rollback on error"
    - "pendingMutations Set in Zustand for delta conflict guard (SYNC-04)"
    - "cancelQueries before setQueryData in onMutate to prevent race conditions"
    - "onSuccess replaces optimistic with full server response (captures server-computed fields)"
    - "onSettled removes from pendingMutations + invalidateQueries"
    - "Delta merge skips server state for tasks in pendingMutations Set"
    - "removedIds loop also guards against pendingMutations before deleting"
    - "Graph dateTimeTimeZone object format (not plain ISO string) via toGraphDateTime"
key_files:
  created:
    - src/lib/graph-utils.ts (toGraphDateTime helper for Graph dateTimeTimeZone format)
    - src/features/tasks/hooks/useUpdateTask.ts (optimistic PATCH with conflict guard)
    - src/features/tasks/hooks/useCompleteTask.ts (status toggle wrapper around useUpdateTask)
  modified:
    - src/stores/sync.store.ts (pendingMutations Set + add/remove actions)
    - src/features/tasks/api/tasks.api.ts (updateTask PATCH function added)
    - src/features/tasks/hooks/useTasks.ts (delta merge conflict guard added)
    - src/features/tasks/components/TaskItem.tsx (inline edit + complete toggle + importance toggle)
    - src/features/tasks/components/TaskList.tsx (useUpdateTask + useCompleteTask wired)
    - src/features/tasks/index.ts (barrel updated with new exports)
    - src/App.tsx (Toaster component mounted)
decisions:
  - "pendingMutations excluded from Zustand partialize — transient in-memory state resets on page load, no pending mutations on fresh load"
  - "Conflict guard in both tasks loop and removedIds loop — prevents server deletes from removing tasks being mutated by another client"
  - "onSuccess replaces optimistic task with full server response — captures server-computed fields like lastModifiedDateTime"
  - "useCompleteTask wraps useUpdateTask (not a separate useMutation) — no duplicate mutation tracking logic"
metrics:
  duration: "7 minutes"
  completed: "2026-03-26"
  tasks_completed: 2
  files_created: 3
  files_modified: 7
---

# Phase 03 Plan 02: Edit, Complete, and Conflict Guard Summary

**One-liner:** Optimistic PATCH mutations for title edit, complete toggle, and importance toggle with pendingMutations conflict guard in delta merge — plus inline TaskItem edit UI and Toaster wired in App.

## What Was Built

- **toGraphDateTime helper** (`src/lib/graph-utils.ts`): Converts JS Date to Graph API `dateTimeTimeZone` object format `{ dateTime, timeZone: "UTC" }` — replaces ISO `Z` suffix with `0000000` for 7 decimal places.
- **pendingMutations in sync store** (`src/stores/sync.store.ts`): Added `pendingMutations: Set<string>` field with `addPendingMutation` and `removePendingMutation` actions. NOT persisted (excluded from `partialize`) — transient in-memory state that resets on page load.
- **updateTask API** (`src/features/tasks/api/tasks.api.ts`): `PATCH /me/todo/lists/{listId}/tasks/{taskId}` with `Partial<TodoTask>` body, returns full updated `TodoTask`.
- **useUpdateTask hook** (`src/features/tasks/hooks/useUpdateTask.ts`): `onMutate` registers taskId in `pendingMutations`, cancels in-flight queries, snapshots cache, optimistically merges patch. `onSuccess` replaces optimistic task with full server response. `onError` restores snapshot + `toast.error`. `onSettled` removes from `pendingMutations` + invalidates query.
- **useCompleteTask hook** (`src/features/tasks/hooks/useCompleteTask.ts`): Wraps `useUpdateTask` to toggle status between `"completed"` and `"notStarted"`. Returns `toggleComplete(task)` function.
- **Delta conflict guard** (`src/features/tasks/hooks/useTasks.ts`): In incremental sync branch, reads `useSyncStore.getState().pendingMutations` once. Tasks merge loop `continue`s past tasks whose ID is in `pendingMutations`. `removedIds` loop skips deletion for IDs in `pendingMutations`.
- **TaskItem inline edit + toggles** (`src/features/tasks/components/TaskItem.tsx`): Status icon wrapped in button that calls `onToggleComplete`. Title span is `cursor-text` — clicking enters edit mode (`isEditing` state) with auto-focused `<input>`. Enter/blur saves; Escape cancels. Star icon wrapped in button that calls `handleImportanceToggle` (toggles between `"normal"` and `"high"`). Added `onToggleComplete` and `onUpdate` props.
- **TaskList wired** (`src/features/tasks/components/TaskList.tsx`): Imports `useUpdateTask` and `useCompleteTask`, calls both hooks, passes `onToggleComplete={toggleComplete}` and `onUpdate` to every `TaskItem`.
- **Barrel updated** (`src/features/tasks/index.ts`): Exports `useUpdateTask`, `useCompleteTask`, `updateTask`.
- **Toaster mounted** (`src/App.tsx`): `<Toaster position="bottom-right" richColors closeButton />` inside `AppContent` return — all mutation toast errors from Plans 03-01 and 03-02 are now visible.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| pendingMutations not persisted in Zustand | Transient state — no mutations are in-flight on fresh page load, so reset is correct behavior |
| Conflict guard in both merge loop AND removedIds loop | Covers edge case: task being edited on this client was deleted on another client |
| onSuccess replaces optimistic with full server task | Graph returns computed fields (lastModifiedDateTime etc.) that the patch body doesn't contain |
| useCompleteTask reuses useUpdateTask | Avoids duplicate mutation lifecycle logic; conflict guard works automatically |
| Toaster at bottom-right with richColors + closeButton | Avoids overlap with SyncStatusBar; error toasts clearly red; user can dismiss |

## Deviations from Plan

None — plan executed exactly as written. sonner was already installed from Plan 03-01 (skipped install step).

## Known Stubs

None — mutations call real Graph API PATCH endpoint; inline edit, complete toggle, and importance toggle all wire through to Graph.

## Verification Results

All plan verification checks passed:

- `npx tsc --noEmit` exits with code 0
- `npm run build` exits with code 0
- `grep "export async function updateTask" src/features/tasks/api/tasks.api.ts` matches
- `grep 'method.*PATCH' src/features/tasks/api/tasks.api.ts` matches
- `grep "addPendingMutation" src/features/tasks/hooks/useUpdateTask.ts` matches
- `grep "removePendingMutation" src/features/tasks/hooks/useUpdateTask.ts` matches
- `grep "pendingMutations.has" src/features/tasks/hooks/useTasks.ts` matches (both merge and removedIds loops)
- `grep "continue" src/features/tasks/hooks/useTasks.ts` matches in merge loop
- `grep "toGraphDateTime" src/lib/graph-utils.ts` matches
- `grep 'replace.*Z.*0000000' src/lib/graph-utils.ts` matches
- `grep "onToggleComplete" src/features/tasks/components/TaskItem.tsx` matches
- `grep "onUpdate" src/features/tasks/components/TaskItem.tsx` matches
- `grep "isEditing" src/features/tasks/components/TaskItem.tsx` matches
- `grep "handleImportanceToggle" src/features/tasks/components/TaskItem.tsx` matches
- `grep "useCompleteTask" src/features/tasks/components/TaskList.tsx` matches
- `grep "useUpdateTask" src/features/tasks/components/TaskList.tsx` matches
- `grep "Toaster" src/App.tsx` matches
- `grep "pendingMutations.*Set" src/stores/sync.store.ts` matches

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 3e9815f | feat(03-write-operations-02): add updateTask API, useUpdateTask/useCompleteTask hooks, pendingMutations store, toGraphDateTime helper |
| Task 2 | 5d84b76 | feat(03-write-operations-02): add delta conflict guard, TaskItem inline edit + toggles, Toaster in App |

## Self-Check: PASSED
