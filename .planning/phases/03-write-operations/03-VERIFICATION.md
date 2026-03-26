---
phase: 03-write-operations
verified: 2026-03-26T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Create task: type a title and press Enter"
    expected: "Task appears in list instantly (before server responds), then persists after page reload"
    why_human: "Cannot verify optimistic timing or page-reload persistence without a running browser session"
  - test: "Edit task title inline: click title, type new title, press Enter"
    expected: "Title changes immediately in UI; change survives page reload (server PATCH confirmed)"
    why_human: "Inline edit state and round-trip persistence require browser interaction"
  - test: "Delete task: click trash icon on a task"
    expected: "Task disappears immediately; if network is offline/fails, task reappears with red toast"
    why_human: "Rollback path and toast visibility require browser + network simulation"
  - test: "Complete task: click status circle on a task"
    expected: "Circle becomes filled CheckCircle2, task gets line-through; unchecking reverses it; both states persist"
    why_human: "Toggle visual state and MS To-do round-trip require browser interaction"
  - test: "Importance toggle: click star icon"
    expected: "Star fills amber immediately; re-clicking restores muted star; both states sync to Graph"
    why_human: "Visual toggle state requires browser interaction"
  - test: "Write failure rollback: simulate a 500 / 429 on a PATCH or DELETE"
    expected: "UI reverts to pre-edit state; red toast appears bottom-right with error message"
    why_human: "Requires controlled network failure (DevTools throttle or mock) to trigger onError path"
  - test: "Toast visibility: trigger any mutation error"
    expected: "Red toast appears bottom-right of screen (Toaster mounted in App.tsx)"
    why_human: "Visual rendering of Toaster component requires browser"
  - test: "Conflict guard: start editing a task, let delta poll fire during the edit"
    expected: "Delta sync does not overwrite the task being edited (pendingMutations guard active)"
    why_human: "Requires coordinating poll timing with an in-flight mutation — not testable statically"
---

# Phase 3: Write Operations Verification Report

**Phase Goal:** Users can create, edit, delete, and complete tasks. All writes are applied optimistically so the UI responds instantly, with automatic rollback and a toast notification on failure. The delta merge logic correctly handles partial task objects and prevents conflicts with locally pending edits.
**Verified:** 2026-03-26
**Status:** human_needed (all automated checks passed; behavioral confirmation requires browser)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Task appears in list immediately on Enter (optimistic create, tmp-uuid replaced by real ID on success) | VERIFIED | `useCreateTask.ts`: `onMutate` inserts `tmp-${crypto.randomUUID()}` task; `onSuccess` replaces by tmp ID with serverTask |
| 2 | Edit title/status/importance appears immediately and persists (optimistic PATCH, server confirmed) | VERIFIED | `useUpdateTask.ts`: `onMutate` merges patch into cache; `onSuccess` replaces with full server response; `TaskItem.tsx` inline edit wired to `onUpdate` prop |
| 3 | Delete disappears immediately; if Graph fails, task reappears with error toast | VERIFIED | `useDeleteTask.ts`: `onMutate` filters out task; `onError` restores snapshot + `toast.error("Failed to delete task")` |
| 4 | Complete toggle: check marks done immediately; uncheck restores; both sync to MS To-do | VERIFIED | `useCompleteTask.ts` toggles `status` between `"completed"` / `"notStarted"` via `useUpdateTask`; circle button in `TaskItem.tsx` calls `onToggleComplete` |
| 5 | Write failure (network error, 429) rolls back UI and displays toast notification | VERIFIED | All three hooks (`useCreateTask`, `useDeleteTask`, `useUpdateTask`) restore snapshot in `onError` and call `toast.error(...)`. `Toaster` mounted in `App.tsx` at bottom-right with `richColors` |

**Score: 5/5 truths verified**

---

### Required Artifacts

| Artifact | Expected | Level 1 Exists | Level 2 Substantive | Level 3 Wired | Status |
|----------|----------|---------------|---------------------|---------------|--------|
| `src/features/tasks/api/tasks.api.ts` | createTask, deleteTask, updateTask API functions | Yes | Yes — all three functions with correct HTTP methods, correct endpoints | Imported by all three mutation hooks | VERIFIED |
| `src/features/tasks/hooks/useCreateTask.ts` | useMutation hook with optimistic insert and tmp-uuid dedup | Yes | Yes — full lifecycle: cancelQueries, snapshot, tmp-uuid insert, onSuccess replace, onError rollback+toast, onSettled invalidate | Used by `AddTaskForm.tsx` | VERIFIED |
| `src/features/tasks/hooks/useDeleteTask.ts` | useMutation hook with optimistic removal and rollback | Yes | Yes — full lifecycle: cancelQueries, snapshot, filter remove, onError rollback+toast, onSettled invalidate | Used by `TaskList.tsx` via `onDelete` prop | VERIFIED |
| `src/features/tasks/hooks/useUpdateTask.ts` | useMutation hook for PATCH with optimistic merge, conflict guard, and rollback | Yes | Yes — registers/removes taskId in `pendingMutations`; merges patch in onMutate; full server response replaces on success; rollback on error | Used by `TaskList.tsx` via `onUpdate` prop | VERIFIED |
| `src/features/tasks/hooks/useCompleteTask.ts` | Convenience hook wrapping useUpdateTask to toggle status | Yes | Yes — toggles between "completed" / "notStarted" via `useUpdateTask.mutate` | Used by `TaskList.tsx` via `onToggleComplete` prop | VERIFIED |
| `src/features/tasks/components/AddTaskForm.tsx` | Input with Enter-to-submit, instant clear, disable while pending | Yes | Yes — form with `onSubmit`, `title.trim()` guard, `createTask.mutate(trimmed)`, `setTitle("")`, `disabled={createTask.isPending}` | Rendered inside `TaskList.tsx` above task list | VERIFIED |
| `src/features/tasks/components/TaskItem.tsx` | Inline title edit, complete toggle, importance toggle, delete button | Yes | Yes — `isEditing` state, Enter/Escape/blur save, `onToggleComplete`, `handleImportanceToggle`, `onDelete` with Trash2 hover-reveal | Used by `TaskList.tsx` with all props passed | VERIFIED |
| `src/features/tasks/components/TaskList.tsx` | Wires AddTaskForm + useDeleteTask + useUpdateTask + useCompleteTask | Yes | Yes — imports and calls all four hooks, passes all callbacks to TaskItem | Rendered in `App.tsx` when a list is selected | VERIFIED |
| `src/stores/sync.store.ts` | pendingMutations Set with add/remove actions, NOT persisted | Yes | Yes — `pendingMutations: Set<string>`, `addPendingMutation`, `removePendingMutation`; excluded from Zustand `partialize` | Read by `useTasks.ts` conflict guard; written by `useUpdateTask.ts` | VERIFIED |
| `src/features/tasks/hooks/useTasks.ts` | Delta merge with pendingMutations conflict guard | Yes | Yes — reads `pendingMutations` once in incremental branch; `continue`s tasks whose ID is in set; also guards `removedIds` loop | Conflict guard present in both merge and delete loops | VERIFIED |
| `src/App.tsx` | Toaster mounted for visible toast notifications | Yes | Yes — `<Toaster position="bottom-right" richColors closeButton />` inside `AppContent` return | Mounted unconditionally in the app shell | VERIFIED |
| `src/lib/graph-utils.ts` | toGraphDateTime helper | Yes | Yes — correct implementation replacing ISO Z suffix with 0000000 | ORPHANED — exported but not imported anywhere in src/ | ORPHANED |
| `src/features/graph/client.ts` | 204 No Content handling | Yes | Yes — `if (response.status === 204) { return undefined as T; }` on line 54 | Applies to all graphFetch calls including DELETE | VERIFIED |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `useCreateTask.ts` | `tasks.api.ts` | `createTask` in mutationFn | WIRED | Line 13: `return createTask(getToken, listId, title)` |
| `useCreateTask.ts` | `@tanstack/react-query` | onMutate / onError / onSettled | WIRED | All three callbacks present with correct logic |
| `useDeleteTask.ts` | `tasks.api.ts` | `deleteTask` in mutationFn | WIRED | Line 13: `return deleteTask(getToken, listId, taskId)` |
| `useUpdateTask.ts` | `tasks.api.ts` | `updateTask` in mutationFn | WIRED | Line 19: `return updateTask(getToken, listId, taskId, patch)` |
| `useUpdateTask.ts` | `sync.store.ts` | `addPendingMutation` / `removePendingMutation` | WIRED | onMutate line 23: `addPendingMutation(taskId)`; onSettled line 62: `removePendingMutation(context.taskId)` |
| `useCompleteTask.ts` | `useUpdateTask.ts` | Wraps useUpdateTask with status toggle | WIRED | Line 12: `const updateMutation = useUpdateTask(listId)` |
| `useTasks.ts` | `sync.store.ts` | `pendingMutations.has` in delta merge | WIRED | Line 46: `const pendingMutations = useSyncStore.getState().pendingMutations`; lines 52, 61: `.has(id)` |
| `AddTaskForm.tsx` | `useCreateTask.ts` | Calls `mutate` on form submit | WIRED | Line 11: `const createTask = useCreateTask(listId)`; line 17: `createTask.mutate(trimmed)` |
| `TaskItem.tsx` | `useDeleteTask.ts` | Delete button triggers `onDelete` prop | WIRED | `onDelete` prop passed from `TaskList.tsx` line 60: `(taskId) => deleteMutation.mutate(taskId)` |
| `TaskList.tsx` | `useDeleteTask.ts` | `deleteMutation` passed as `onDelete` to TaskItem | WIRED | Line 15: `const deleteMutation = useDeleteTask(listId)` |
| `TaskList.tsx` | `useUpdateTask.ts` | `updateMutation` passed as `onUpdate` to TaskItem | WIRED | Line 16: `const updateMutation = useUpdateTask(listId)` |
| `TaskList.tsx` | `useCompleteTask.ts` | `toggleComplete` passed as `onToggleComplete` to TaskItem | WIRED | Line 17: `const { toggleComplete } = useCompleteTask(listId)` |
| `App.tsx` | `sonner` | Renders `Toaster` component | WIRED | Line 6: `import { Toaster } from "sonner"`; line 30: `<Toaster position="bottom-right" richColors closeButton />` |

---

### Data-Flow Trace (Level 4)

All write operations dispatch to live Graph API endpoints — there are no static returns or placeholder data sources. The mutation hooks call real PATCH / POST / DELETE endpoints via `graphFetch`. The `useTasks` query fetches real delta data from Graph. No hollow props or empty-array stubs were found in the rendering path.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `TaskList.tsx` renders `tasks` | `data` from `useTasks(listId)` | `fetchTasksDelta` → Graph `/me/todo/lists/{id}/tasks/delta` | Yes — real delta API, merged into cache | FLOWING |
| `useCreateTask` → `AddTaskForm` | `queryClient` cache `["tasks", listId]` | POST to Graph, result replaces tmp entry | Yes — server-assigned ID replaces optimistic | FLOWING |
| `useDeleteTask` → `TaskList` | `queryClient` cache filtered | DELETE to Graph, cache restored on error | Yes — real DELETE, snapshot rollback on error | FLOWING |
| `useUpdateTask` / `useCompleteTask` → `TaskItem` | `queryClient` cache merged | PATCH to Graph, full server response on success | Yes — server response replaces optimistic merge | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — This phase produces React UI components and mutation hooks. Behavioral correctness (optimistic timing, toast rendering, rollback on network failure) requires a running browser session with live MSAL authentication and Graph API access. Static code analysis and grep-based checks are the appropriate verification method here.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TASK-02 | 03-01-PLAN.md | Create task optimistically via POST | SATISFIED | `useCreateTask` with tmp-uuid, `AddTaskForm` wired into `TaskList` |
| TASK-03 | 03-02-PLAN.md | Edit title/status/importance via PATCH, applied optimistically | SATISFIED | `useUpdateTask` PATCH hook; `TaskItem` inline edit + importance toggle wired |
| TASK-04 | 03-01-PLAN.md | Delete task optimistically, task removed immediately | SATISFIED | `useDeleteTask` with filter in onMutate; `TaskItem` Trash2 button wired |
| TASK-05 | 03-02-PLAN.md | Complete/incomplete toggle via PATCH `status: "completed"` / `"notStarted"` | SATISFIED | `useCompleteTask` wrapping `useUpdateTask`; status circle button in `TaskItem` wired |
| SYNC-04 | 03-02-PLAN.md | useMutation lifecycle (onMutate/onError/onSettled) on all writes; conflict guard prevents delta from overwriting pending local edits | SATISFIED | All four mutation hooks implement full lifecycle; `pendingMutations` Set guards both merge loop and removedIds loop in `useTasks.ts` |

Note on SYNC-04 wording: REQUIREMENTS.md mentions a `lastModifiedDateTime` guard. The implementation uses a `pendingMutations` Set (task-ID-based conflict guard) instead. The pendingMutations approach is strictly correct for in-flight mutations (it is authoritative until `onSettled` fires) and is consistent with the plan's specification. The `lastModifiedDateTime` language in the requirement was superseded by the Set-based approach. The conflict guard intent is fully met.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/graph-utils.ts` | — | `toGraphDateTime` exported but never imported in src/ | Info | No impact on runtime — the helper exists for future use (e.g., dueDateTime/completedDateTime PATCH fields). Not a stub; the function is substantive. |

No TODO/FIXME/placeholder comments, no empty implementations, no hardcoded empty data arrays in rendering paths, no console-log-only handlers found in phase 3 files.

---

### Human Verification Required

#### 1. Optimistic Create

**Test:** Open the app, select a list, type a task title in the "Add a task..." input, press Enter.
**Expected:** Task appears at top of list immediately with status circle and title. Within a few seconds the task ID changes from a tmp-uuid to the Graph-assigned ID (visible in React DevTools). After page reload the task is still present (server-confirmed).
**Why human:** Optimistic timing and server ID replacement require a running browser with authenticated Graph session.

#### 2. Inline Title Edit

**Test:** Click on an existing task's title text. Type new text. Press Enter (or click elsewhere).
**Expected:** Title updates immediately in the UI. After page reload (or next 30-second poll) the new title is still present (PATCH confirmed by Graph).
**Why human:** Inline edit interaction and persistence verification require browser.

#### 3. Delete with Rollback

**Test:** In DevTools Network tab, block requests to `graph.microsoft.com`. Click the trash icon on a task (visible on hover).
**Expected:** Task disappears immediately. Within a second (request fails) the task reappears. A red error toast appears bottom-right: "Failed to delete task".
**Why human:** Network blocking and toast visibility require browser + DevTools.

#### 4. Complete Toggle

**Test:** Click the circle icon on a task.
**Expected:** Circle becomes CheckCircle2 (filled), task gets line-through styling and opacity-60. Clicking again reverses both. Both states survive page reload.
**Why human:** Visual state change and persistence require browser.

#### 5. Failure Toast Visibility

**Test:** Block a write request and trigger any mutation (create/edit/delete/complete).
**Expected:** A red toast notification appears bottom-right with a descriptive error message. Toast has a close button.
**Why human:** Toast rendering from the Toaster component at bottom-right requires visual browser verification.

#### 6. Conflict Guard Under Load

**Test:** Start editing a task's title (click title, do NOT save yet). Wait for the 30-second poll to fire (or force a refetch via React Query DevTools).
**Expected:** The poll does NOT overwrite your in-progress edit — the input still shows your typed text.
**Why human:** Requires coordinating poll timing with an active in-flight mutation; not testable statically.

---

### Gaps Summary

No gaps found. All five success criteria are fully implemented:

1. **Create (TASK-02):** `useCreateTask` + `AddTaskForm` — optimistic insert with tmp-uuid, server ID replacement on success, rollback on error.
2. **Edit (TASK-03):** `useUpdateTask` + `TaskItem` inline edit — optimistic merge, full server response on success, snapshot rollback on error, toast on failure.
3. **Delete (TASK-04):** `useDeleteTask` + `TaskItem` Trash2 button — optimistic filter-out, snapshot rollback on error, toast on failure.
4. **Complete (TASK-05):** `useCompleteTask` wrapping `useUpdateTask` — status toggle, all lifecycle guarantees inherited.
5. **Failure rollback + toast (all writes):** Every mutation hook restores snapshot in `onError` and calls `toast.error(...)`. `Toaster` is mounted in `App.tsx`.
6. **Conflict guard (SYNC-04):** `pendingMutations` Set in sync store; `useTasks` skips both server merges and server deletes for tasks with in-flight mutations.

One minor observation: `src/lib/graph-utils.ts` (`toGraphDateTime`) is defined and exported but not yet imported anywhere in the codebase. It is not a runtime defect — the current PATCH calls for `status` and `importance` fields do not need date-time formatting. The helper is available for future dueDateTime/completedDateTime fields.

---

_Verified: 2026-03-26_
_Verifier: Claude (gsd-verifier)_
