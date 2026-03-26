---
phase: 03-write-operations
plan: 01
subsystem: tasks-mutations
tags: [tanstack-query, optimistic-updates, mutations, create, delete, sonner, toast]
dependency_graph:
  requires: [02-02-SUMMARY, tasks-delta-hook, graph-client, auth-hook]
  provides: [useCreateTask, useDeleteTask, AddTaskForm, createTask-api, deleteTask-api]
  affects: [03-02-write-operations]
tech_stack:
  added:
    - "sonner (toast notifications)"
  patterns:
    - "Optimistic insert with tmp-{uuid} ID replaced by real server ID on success"
    - "Optimistic remove with snapshot rollback on error"
    - "cancelQueries before setQueryData in onMutate to prevent race conditions"
    - "invalidateQueries in onSettled to re-sync cache with server after mutation"
    - "204 No Content handling in graphFetch (return undefined as T)"
key_files:
  created:
    - src/features/tasks/api/tasks.api.ts (createTask + deleteTask added)
    - src/features/tasks/hooks/useCreateTask.ts
    - src/features/tasks/hooks/useDeleteTask.ts
    - src/features/tasks/components/AddTaskForm.tsx
  modified:
    - src/features/graph/client.ts (204 handling)
    - src/features/tasks/components/TaskItem.tsx (onDelete + Trash2)
    - src/features/tasks/components/TaskList.tsx (AddTaskForm + useDeleteTask wired)
    - src/features/tasks/index.ts (barrel updated)
decisions:
  - "204 No Content handled in graphFetch (not in each caller) — single fix location, all DELETE callers benefit"
  - "AddTaskForm clears input immediately after mutate call — optimistic UX, input ready for next task before server responds"
  - "Delete button opacity-0 group-hover:opacity-100 — avoids cluttered UI, action visible on intent"
metrics:
  duration: "8 minutes"
  completed: "2026-03-26"
  tasks_completed: 2
  files_created: 4
  files_modified: 4
---

# Phase 03 Plan 01: Create and Delete Task Mutations Summary

**One-liner:** Optimistic create (tmp-uuid replaced on success) and delete (snapshot rollback on error) mutations via TanStack Query, with AddTaskForm input and hover-reveal Trash2 delete button wired into TaskList.

## What Was Built

- **createTask API** (`src/features/tasks/api/tasks.api.ts`): POST `/me/todo/lists/${listId}/tasks` with `{ title, status: "notStarted" }` body, returns server `TodoTask` with real Graph-assigned ID.
- **deleteTask API** (`src/features/tasks/api/tasks.api.ts`): DELETE `/me/todo/lists/${listId}/tasks/${taskId}`, returns void (204 No Content).
- **graphFetch 204 fix** (`src/features/graph/client.ts`): Added `response.status === 204` early-return before `response.json()` — prevents JSON parse error on empty DELETE response body.
- **useCreateTask hook** (`src/features/tasks/hooks/useCreateTask.ts`): `onMutate` cancels queries, snapshots cache, inserts optimistic task with `tmp-${crypto.randomUUID()}` ID. `onSuccess` replaces the tmp entry with real server task (prevents delta sync duplicates). `onError` restores snapshot + `toast.error`. `onSettled` invalidates query.
- **useDeleteTask hook** (`src/features/tasks/hooks/useDeleteTask.ts`): `onMutate` cancels queries, snapshots, filters out task by ID. `onError` restores snapshot + `toast.error`. `onSettled` invalidates query.
- **AddTaskForm component** (`src/features/tasks/components/AddTaskForm.tsx`): Form with Enter-to-submit, Plus icon, input disabled while pending, clears immediately after `mutate()` call for instant optimistic UX.
- **TaskItem updated** (`src/features/tasks/components/TaskItem.tsx`): Added `onDelete?: (taskId: string) => void` prop, `group` class on container, Trash2 button with `opacity-0 group-hover:opacity-100` reveal, `aria-label="Delete task"`.
- **TaskList updated** (`src/features/tasks/components/TaskList.tsx`): Wires `AddTaskForm` at top (inside `border-b`), `useDeleteTask` hook, passes `onDelete` callback to each `TaskItem`. Layout changed to `flex flex-col h-full` for proper scroll containment.
- **Barrel updated** (`src/features/tasks/index.ts`): Exports `AddTaskForm`, `useCreateTask`, `useDeleteTask`, `createTask`, `deleteTask`.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| 204 fix in graphFetch, not in deleteTask caller | Single fix benefits all future DELETE callers — DRY |
| Input clears immediately after mutate() | Optimistic UX — user can type next task while server processes first |
| Delete button hidden until hover | Cleaner task list UI — action visible only on hover intent |
| sonner installed for toast | Plan spec called for it; Plan 03-02 will wire Toaster component |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed graphFetch 204 No Content parse error**
- **Found during:** Task 1 (pre-emptive read of client.ts)
- **Issue:** `graphFetch` called `response.json()` for all `response.ok` statuses. DELETE returns 204 with empty body — `response.json()` would throw a JSON parse error.
- **Fix:** Added `if (response.status === 204) { return undefined as T; }` before the `response.ok` branch in `graphFetch`.
- **Files modified:** `src/features/graph/client.ts`
- **Commit:** d55df65

## Known Stubs

None — mutations call real Graph API endpoints; toast notifications wired to sonner (Toaster component to be added in Plan 03-02).

## Verification Results

All plan verification checks passed:

- `npx tsc --noEmit` exits with code 0
- `npm run build` exits with code 0
- `grep "export async function createTask" src/features/tasks/api/tasks.api.ts` matches
- `grep "export async function deleteTask" src/features/tasks/api/tasks.api.ts` matches
- `grep "tmp-" src/features/tasks/hooks/useCreateTask.ts` matches
- `grep "cancelQueries" src/features/tasks/hooks/useCreateTask.ts` matches
- `grep "invalidateQueries" src/features/tasks/hooks/useCreateTask.ts` matches
- `grep "toast.error" src/features/tasks/hooks/useDeleteTask.ts` matches
- `grep "Trash2" src/features/tasks/components/TaskItem.tsx` matches
- `grep "AddTaskForm" src/features/tasks/components/TaskList.tsx` matches
- `grep "useDeleteTask" src/features/tasks/components/TaskList.tsx` matches

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | d55df65 | feat(03-write-operations-01): add createTask/deleteTask API and optimistic mutation hooks |
| Task 2 | b47aee4 | feat(03-write-operations-01): build AddTaskForm, update TaskItem with delete button, wire TaskList |

## Self-Check: PASSED
