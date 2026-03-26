---
phase: 02-core-data-layer
plan: 02
subsystem: data-layer
tags: [tanstack-query, delta-sync, tasks, polling, flagged-emails, sync-status]
dependency_graph:
  requires: [02-01-SUMMARY, sync-store, graph-client, task-lists-hook]
  provides: [tasks-delta-hook, task-list-ui, task-item-ui, sync-status-bar]
  affects: [03-write-operations]
tech_stack:
  added: []
  patterns:
    - "Task delta query with per-list deltaLink storage (tasksDeltaLinks[listId])"
    - "Shallow merge pattern for partial delta updates ({ ...existing, ...deltaTask })"
    - "removedIds separation from delta response for clean Map.delete() cache eviction"
    - "410 Gone per-list recovery: clearTasksDeltaLink + resyncing status + full retry"
    - "30s polling with refetchIntervalInBackground: false (pauses on hidden tab)"
    - "Relative time formatter (Just now / Xs ago / X min ago / Xh ago)"
key_files:
  created:
    - src/features/tasks/api/tasks.api.ts
    - src/features/tasks/hooks/useTasks.ts
    - src/features/tasks/components/TaskList.tsx
    - src/features/tasks/components/TaskItem.tsx
    - src/features/tasks/index.ts
    - src/features/sync/components/SyncStatusBar.tsx
    - src/features/sync/index.ts
  modified:
    - src/App.tsx
decisions:
  - "Separated @removed items into removedIds array in fetchTasksDelta — cleaner caller interface vs. checking @removed in the hook"
  - "existingDeltaLink captured before queryFn async work — determines initial vs incremental merge branch without race conditions"
  - "isFromFlaggedEmails derived at TaskList level by comparing listId to flaggedEmailsListId — all tasks in the list get Outlook badge uniformly"
  - "SyncStatusBar reads syncStatus from Zustand directly — status updates propagate immediately without re-fetch"
metrics:
  duration: "6 minutes"
  completed: "2026-03-26"
  tasks_completed: 2
  files_created: 7
  files_modified: 1
---

# Phase 02 Plan 02: Task Delta Sync + Task UI + Sync Status Bar Summary

**One-liner:** Task delta sync hook (30s polling, shallow merge, 410 recovery) + TaskList/TaskItem components with flagged email Outlook badge + SyncStatusBar with relative timestamps, wired into App layout.

## What Was Built

- **Task delta API** (`src/features/tasks/api/tasks.api.ts`): `fetchTasksDelta` paginates all nextLink pages, separates `@removed` items into `removedIds`, captures `deltaLink` from the final page only. Per-list URL: `/me/todo/lists/${listId}/tasks/delta`
- **useTasks hook** (`src/features/tasks/hooks/useTasks.ts`): TanStack Query with `queryKey: ["tasks", listId]`, `refetchInterval: 30_000`, `refetchIntervalInBackground: false`. Delta merge uses a Map for shallow-merge of partial updates and `removedIds` deletion. 410 Gone handler clears this list's deltaLink, sets status to `resyncing`, retries with full sync.
- **TaskItem component** (`src/features/tasks/components/TaskItem.tsx`): Displays title (line-through when completed), Circle/CheckCircle2 status icon, Star (amber, filled) for high importance, Outlook badge (Mail icon + "Outlook" text in blue) for flagged email tasks.
- **TaskList component** (`src/features/tasks/components/TaskList.tsx`): Loading skeleton (5 pulse placeholders, only on first load), error state with message, empty state "No tasks in this list", task list with `isFromFlaggedEmails` derived by comparing `listId` to `flaggedEmailsListId`.
- **SyncStatusBar** (`src/features/sync/components/SyncStatusBar.tsx`): Reads `syncStatus` and `lastSyncedAt` from Zustand. Shows Loader2/RefreshCw (animate-spin), Check (green), AlertCircle (red). Relative time: "Just now" (<10s), "Xs ago" (<60s), "X min ago" (<1h), "Xh ago".
- **App.tsx**: TaskList rendered in main content for `selectedListId`, SyncStatusBar in footer (border-t). Layout: header | sidebar + main | footer.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| removedIds separated in fetchTasksDelta | Cleaner hook interface — caller does `taskMap.delete(id)` per id vs. rechecking @removed in hook |
| existingDeltaLink captured before async work | Determines initial vs incremental branch deterministically — avoids reading stale store mid-fetch |
| isFromFlaggedEmails at TaskList level | All tasks in the flagged list get badge uniformly — simpler than passing flaggedListId to each TaskItem |
| SyncStatusBar reads Zustand directly | No re-fetch needed — status updates propagate immediately via Zustand subscription |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is wired to live Graph API via useTasks hook.

## Verification Results

All plan verification checks passed:

- `npx tsc --noEmit` exits with code 0
- `npm run build` exits with code 0
- `grep refetchInterval.*30 src/features/tasks/hooks/useTasks.ts` matches
- `grep refetchIntervalInBackground.*false src/features/tasks/hooks/useTasks.ts` matches
- `grep @removed src/features/tasks/api/tasks.api.ts` matches
- `grep removedIds src/features/tasks/api/tasks.api.ts` matches
- `grep clearTasksDeltaLink src/features/tasks/hooks/useTasks.ts` matches
- `grep resyncing src/features/tasks/hooks/useTasks.ts` matches
- `grep Outlook src/features/tasks/components/TaskItem.tsx` matches
- `grep flaggedEmailsListId src/features/tasks/components/TaskList.tsx` matches
- `grep lastSyncedAt src/features/sync/components/SyncStatusBar.tsx` matches
- `grep Re-syncing src/features/sync/components/SyncStatusBar.tsx` matches
- `grep TaskList src/App.tsx` matches
- `grep SyncStatusBar src/App.tsx` matches

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 8630df7 | feat(02-core-data-layer-02): implement task delta sync hook with 30s polling |
| Task 2 | 2ed1e26 | feat(02-core-data-layer-02): build TaskList, TaskItem, SyncStatusBar and wire App |

## Self-Check: PASSED
