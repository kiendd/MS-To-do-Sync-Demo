---
area: Two-way Sync Architecture
researcher: gsd-project-researcher
date: 2026-03-26
---

# Two-way Sync Architecture: Browser SPA + Microsoft To-do (Graph API)

**Confidence:** HIGH for all Graph API facts (sourced from official Microsoft docs, verified 2026-03-26).
MEDIUM for React state management recommendations (based on well-established community patterns; TanStack Query docs were inaccessible during research but conclusions match known stable behavior as of v5).

---

## 1. Sync Strategy: Polling vs. Webhooks vs. Delta

### The Graph API gives you two primitives

| Primitive | Model | What it does |
|---|---|---|
| **Delta query** (`/tasks/delta`) | Pull (polling) | Returns only changed tasks since your last `deltaLink` token |
| **Change notifications** (webhooks) | Push | Graph POSTs a notification to your endpoint when a task changes |

### Why webhooks are not viable for a browser SPA (no backend)

Webhooks require Graph to POST to a publicly reachable HTTPS endpoint that you own. A browser tab is not a server — it has no public URL, it closes when the user navigates away, and it cannot receive inbound HTTP requests. Webhooks also require subscription management (creating, renewing before expiry, handling `validationToken` challenges at subscription creation time). For `todoTask`, the maximum subscription lifetime is **4,230 minutes (~3 days)**, meaning the SPA would need to silently renew subscriptions periodically even if you were running a backend.

**Conclusion: Webhooks require a backend relay. Do not use them in a no-backend SPA.**

### Delta query is the correct primitive for this SPA

Delta query is a poll-based pull model — the SPA calls Graph on its own schedule, sends the stored `deltaLink`, and receives only what changed. This is:
- Entirely client-side (no inbound connections needed)
- Cheap (empty response when nothing changed, no full list scan)
- Officially recommended by Microsoft over simple polling
- Available for both `todoTask` and `todoTaskList` on v1.0

**Endpoint:**
```
GET /me/todo/lists/{listId}/tasks/delta
GET /me/todo/lists/{listId}/tasks/delta?$deltatoken={token}
```

### Recommended polling strategy for a browser SPA

Use an interval-based poll driven by a visible-page check:

1. **On app load / tab focus:** Immediately fire a delta sync if more than N seconds have elapsed since the last sync.
2. **Interval:** Poll every 30–60 seconds while the tab is visible (`document.visibilityState === 'visible'`). Pause polling when hidden.
3. **After a local write:** Re-poll after a short delay (e.g. 2–5 seconds) to detect any server-side side-effects.
4. **On `410 Gone` response:** Discard the `deltaLink` and restart with a full sync. Graph returns 410 when the token has expired or the server has been reset.

**Interval recommendation for prototype/daily-use quality:** 30 seconds while visible, paused when hidden.

Note: The Graph docs explicitly state that `todoTask` change notifications have an average latency of less than 2 minutes and a maximum of 15 minutes. A 30-second poll interval is more than sufficient and stays well within throttling headroom.

---

## 2. Conflict Resolution

### What Graph provides

`todoTask` has a `lastModifiedDateTime` (DateTimeOffset, UTC) property. There is **no ETag or version vector** on `todoTask` in the v1.0 API — the `@odata.etag` shown in delta responses is present but Graph does not honor conditional writes (`If-Match`) for To-do tasks in a way that prevents last-write-wins at the server.

**This means Graph is last-write-wins by default.** The server has no built-in conflict detection that will reject a stale write.

### Practical conflict scenario

The user edits Task A in your SPA (local state updated optimistically). Simultaneously, they also edited Task A in the native MS To-do app on their phone. Both clients PATCH the task. Whichever PATCH arrives at Graph last wins on the server side.

### Recommended conflict resolution strategy: Last-write-wins with server authority

For a prototype/daily-use app, implement **server-wins on sync, client-wins on write** with a recency guard:

1. When the user edits a task locally, record a `localEditedAt` timestamp alongside the task in local state.
2. When the next delta sync arrives and a server update is received for that same task ID:
   - If `server.lastModifiedDateTime > localEditedAt`: apply the server version (server is newer, overwrite local). If there is an in-flight PATCH, cancel it.
   - If `server.lastModifiedDateTime < localEditedAt`: our local edit is newer — keep local state, let the in-flight PATCH complete.
   - If equal: treat as no conflict (same edit).
3. If the in-flight PATCH fails with 409 or 412: fall back to the server version via a GET and notify the user if the field they changed was overwritten.

This handles the 95% case without complex CRDT machinery. The 5% edge case (both edits in the same second) silently resolves to server-wins, which is acceptable for prototype quality.

### What NOT to do

Do not implement a merge dialog or field-level merge for a prototype. The complexity is disproportionate to the use case. Server-wins on sync is the same strategy used by most mobile calendar and task apps.

---

## 3. Optimistic Updates

### The pattern

Optimistic updates mean: update the local UI state immediately when the user takes an action, then send the network request in the background. If the request fails, roll back to the previous state.

For this SPA, every local write (create task, update task, complete task, delete task) should be optimistic:

```
User action
  → Apply change to local state immediately (UI updates instantly)
  → PATCH/POST/DELETE to Graph API (async, in background)
    → On success: confirm (optionally reconcile with server response)
    → On failure: roll back local state, show error, optionally queue for retry
```

### What to store to enable rollback

Before applying an optimistic update, snapshot the previous state of the task. Store the snapshot keyed by a `mutationId` (or the task ID). On failure, restore from the snapshot.

```typescript
type PendingMutation = {
  mutationId: string;       // uuid
  taskId: string;
  type: 'create' | 'update' | 'delete';
  previousState: TodoTask | null;  // null for creates
  payload: Partial<TodoTask>;
  attemptedAt: number;      // Date.now()
  status: 'pending' | 'failed';
};
```

### Rollback rules

- **Update fails:** Restore `previousState` for that `taskId`. Show a toast "Could not save change."
- **Create fails:** Remove the optimistically-added task from local state. Use a temporary `id` (e.g. `tmp-{uuid}`) for the optimistic entry so it can be identified and removed.
- **Delete fails:** Re-add the task to local state from `previousState`.
- **Complete fails:** Restore `status` to `notStarted` / `inProgress`.

### Deduplication after create

When Graph responds to a POST with the real task `id`, replace the temporary `tmp-{uuid}` entry in local state with the server-assigned `id`. This prevents duplicate entries on the next delta sync.

---

## 4. Local State: What to Store and Where

### Minimum required local state (per task list)

```typescript
type SyncState = {
  // Delta sync
  deltaLink: string | null;        // URL from last @odata.deltaLink response
  lastSyncedAt: number | null;     // Date.now() of last successful delta sync

  // Tasks
  tasks: Record<string, TodoTask>; // keyed by task id

  // Conflict detection
  localEdits: Record<string, {     // keyed by task id
    editedAt: number;              // Date.now() when local edit was made
    fields: (keyof TodoTask)[];    // which fields were edited
  }>;

  // Optimistic mutation tracking
  pendingMutations: PendingMutation[];

  // Offline queue
  offlineQueue: QueuedOperation[]; // operations to replay when back online

  // Sync status
  syncStatus: 'idle' | 'syncing' | 'error' | 'offline';
  lastSyncError: string | null;
};
```

### Storage layer

Use `localStorage` or `sessionStorage` for the `deltaLink` and `lastSyncedAt` — these must survive a page refresh. The tasks themselves can live in memory (in-RAM state) if you are willing to do a full re-sync on cold load, or in `localStorage`/IndexedDB for an offline-capable experience.

**Recommendation for prototype:** Store `deltaLink` + `lastSyncedAt` in `localStorage`. Store tasks in memory only. On cold load, use the stored `deltaLink` to do an incremental sync (fast) rather than a full list fetch.

**Recommendation for offline-first:** Store tasks in IndexedDB (via `idb` library, ~2KB). This lets the app render immediately on load from cache, then reconcile with Graph in the background.

### Token expiry

Delta tokens for Outlook entities (which includes `todoTask`) have an **unfixed but finite lifetime** based on the internal delta token cache. When the token expires, Graph returns a `410 Gone` or `syncStateNotFound` error. Handle this by discarding the stored `deltaLink`, clearing `tasks`, and performing a fresh full sync. Update the UI to show "Re-syncing..." briefly.

---

## 5. React State Management: Recommendation

### The options evaluated

| Library | Model | Fit for this use case |
|---|---|---|
| **TanStack Query v5** | Server state cache + mutation lifecycle | BEST FIT |
| **Zustand** | Minimal client state store | Good for sync metadata/queue |
| **Jotai** | Atomic derived state | Overkill for this pattern |
| **Redux Toolkit (RTK Query)** | Redux + server state | Heavy; RTK Query less flexible than TanStack for custom sync loops |

### Recommendation: TanStack Query v5 as primary + Zustand for sync metadata

**TanStack Query v5** handles the exact problem space of this project:
- `useQuery` with `staleTime` / `refetchInterval` for the delta polling loop
- `useMutation` with `onMutate` (optimistic update), `onError` (rollback), `onSettled` (re-sync after mutation)
- Built-in cache with manual invalidation via `queryClient.invalidateQueries`
- `refetchOnWindowFocus: true` (built-in) — tab focus triggers re-fetch automatically
- Mutation retry with configurable `retry` count

**Zustand** (1.1KB) is appropriate for the parts that are not server state — the `deltaLink`, `lastSyncedAt`, `pendingMutations`, `offlineQueue`, and `syncStatus` fields. These are local application state, not server cache, so TanStack Query is the wrong tool for them.

**Why not Redux Toolkit / RTK Query:** RTK Query's auto-generated hooks are excellent for standard REST CRUD but the delta sync loop requires a custom query key scheme, custom cache updates, and manual pagination through `@odata.nextLink` responses. TanStack Query gives you full control over `queryFn` with less boilerplate.

**Why not Jotai alone:** Jotai's atom model is excellent for derived UI state but does not provide mutation lifecycle management (optimistic updates, rollback, retry) out of the box. You would end up reimplementing what TanStack Query already does.

### Concrete structure

```
TanStack Query cache:
  queryKey: ['tasks', listId]       → task list data
  queryKey: ['taskLists']           → available lists

Zustand store (syncSlice):
  deltaLinks: Record<listId, string>
  lastSyncedAt: Record<listId, number>
  pendingMutations: PendingMutation[]
  offlineQueue: QueuedOperation[]
  syncStatus: 'idle' | 'syncing' | 'error' | 'offline'
```

### Delta sync as a custom queryFn

The delta sync maps cleanly onto TanStack Query's `queryFn`:

```typescript
useQuery({
  queryKey: ['tasks', listId],
  queryFn: async () => {
    const deltaLink = useSyncStore.getState().deltaLinks[listId];
    const url = deltaLink ?? `/me/todo/lists/${listId}/tasks/delta`;
    const changes = await fetchAllDeltaPages(graphClient, url);
    // Merge changes into existing cache data
    const current = queryClient.getQueryData(['tasks', listId]) ?? {};
    return applyDeltaChanges(current, changes); // returns new task map
  },
  staleTime: 30_000,           // 30 seconds
  refetchInterval: 30_000,     // poll every 30s
  refetchOnWindowFocus: true,
  refetchIntervalInBackground: false,
})
```

---

## 6. Offline Handling

### Detection

Use the `navigator.onLine` property and the `online`/`offline` Window events to detect connectivity changes. Set `syncStatus: 'offline'` in Zustand when offline.

### What to do when offline

1. **Local reads:** Continue to serve from the in-memory (or IndexedDB) task cache. The UI remains fully usable for reading.
2. **Local writes:** Accept the mutation optimistically, apply it to local state, and add it to `offlineQueue` instead of sending to Graph.
3. **Queue schema:**

```typescript
type QueuedOperation = {
  id: string;             // uuid
  type: 'create' | 'update' | 'delete';
  taskId: string;         // server id, or tmp- id for creates
  payload: Partial<TodoTask>;
  queuedAt: number;
  retryCount: number;
};
```

4. **On reconnect (`online` event):** Replay the offline queue in order. For creates, use the real `id` returned by the server to update local references. For conflicts discovered during replay (server version newer than local edit), apply the conflict resolution strategy from section 2.

### What NOT to build for prototype quality

- Do not implement IndexedDB background sync with Service Workers for offline — that is PWA-grade complexity. For a prototype, losing unsynced changes on tab close is acceptable; just warn the user ("You have unsaved changes" via `beforeunload`).
- Do not implement merge of conflicting offline queue entries against server state — server-wins on replay is sufficient.

---

## 7. Real-world Examples and Patterns

### Apps known to sync with Graph API (HIGH confidence from official docs)

The Microsoft Graph documentation itself provides the canonical reference implementations:

- **Microsoft Graph Training: Change Notifications + Change Tracking** — official training module on GitHub (`microsoftgraph/msgraph-training-changenotifications`) demonstrating the combined webhook + delta pattern.
- **Microsoft Graph Webhooks Sample for Node.js** — `microsoftgraph/nodejs-webhooks-rest-sample` — shows the server-side webhook receiver pattern (not applicable to SPA, but useful reference for the notification payload shape).

### Real-world SPA sync pattern (MEDIUM confidence — community consensus)

The dominant pattern used by productivity SPAs syncing with Exchange/Graph (e.g. third-party calendar and task clients) is:

1. **Initial load:** Full list fetch, store `deltaLink`, render.
2. **Steady state:** Poll delta endpoint on interval + window focus. Apply incremental changes to local cache.
3. **Writes:** Optimistic local update → PATCH/POST Graph → confirm or rollback.
4. **Offline:** Queue writes in memory (or localStorage), replay on reconnect.

This is the same pattern used by Microsoft's own Outlook Web App, which is itself a browser SPA talking to Exchange via Graph.

---

## 8. Graph API Facts for Implementation (Verified)

| Fact | Source | Confidence |
|---|---|---|
| `todoTask` supports delta query at v1.0 | learn.microsoft.com/graph/api/todotask-delta | HIGH |
| `todoTaskList` also supports delta query | learn.microsoft.com/graph/delta-query-overview | HIGH |
| `todoTask` webhooks are supported, max lifetime 4,230 min (~3 days) | learn.microsoft.com/graph/change-notifications-overview | HIGH |
| Webhooks for `todoTask` not available in national clouds | same source | HIGH |
| `todoTask` webhook latency: avg <2 min, max 15 min | same source | HIGH |
| No ETag-based conditional writes on `todoTask` (no `If-Match` support documented) | learn.microsoft.com/graph/api/resources/todotask | HIGH |
| `lastModifiedDateTime` available on every task (UTC ISO 8601) | same source | HIGH |
| Delta token lifetime for Outlook entities is unfixed (cache-size-dependent) | learn.microsoft.com/graph/delta-query-overview | HIGH |
| 410 Gone means token expired, must restart full sync | same source | HIGH |
| Throttling: HTTP 429, `Retry-After` header, use exponential backoff | learn.microsoft.com/graph/throttling | HIGH |
| Auth for SPA: MSAL.js v2 / `@azure/msal-browser` with Auth Code + PKCE | learn.microsoft.com/entra/identity-platform/scenario-spa-* | HIGH |
| Required scope for task read/write: `Tasks.ReadWrite` (delegated) | learn.microsoft.com/graph/api/todotask-delta | HIGH |
| Delta supports `$select`, `$top`, `$expand` for todoTask | learn.microsoft.com/graph/api/todotask-delta | HIGH |
| Graph recommends webhooks + delta together (webhook triggers delta call) | learn.microsoft.com/graph/best-practices-concept | HIGH |

---

## 9. Critical Pitfalls

### Pitfall 1: Storing the full delta URL, not just the token

**What goes wrong:** Developer stores only the `$deltatoken` query parameter value, then tries to reconstruct the URL. This can break if the URL structure changes or if encoded query parameters (like `$select`) are embedded in the token.

**Prevention:** Store and reuse the entire `@odata.deltaLink` URL as an opaque string. Never parse or reconstruct it. This is explicitly documented by Microsoft.

### Pitfall 2: Not handling `@odata.nextLink` pagination in delta responses

**What goes wrong:** A delta response with many changes returns `@odata.nextLink` (not `@odata.deltaLink`). If you treat the first response as complete, you save an intermediate skip token as your deltaLink, and on the next poll you miss changes.

**Prevention:** Always follow `@odata.nextLink` pages until you receive `@odata.deltaLink`. Only save `@odata.deltaLink` to persistent state.

### Pitfall 3: Polling while the tab is hidden

**What goes wrong:** Polling every 30 seconds regardless of tab visibility wastes quota and may trigger throttling if the user has the app open in a background tab for hours.

**Prevention:** Use `document.visibilityState` and `visibilitychange` event to pause/resume polling. TanStack Query's `refetchIntervalInBackground: false` handles this automatically.

### Pitfall 4: Not handling 410 Gone

**What goes wrong:** The delta token expires (size-based eviction from Graph's cache). The app gets `410 Gone` or `syncStateNotFound` and crashes or enters an error loop.

**Prevention:** Catch 410/4xx with `syncStateNotFound` error code. Clear the stored `deltaLink`, clear the task cache, and perform a fresh full sync. Show the user a brief "Re-syncing" indicator.

### Pitfall 5: Duplicate tasks from optimistic creates

**What goes wrong:** The SPA adds a task to the cache with `id: 'tmp-abc123'` (optimistic). The POST succeeds and Graph assigns `id: 'AAMk...'`. On the next delta sync, the new task appears with the real ID. If the SPA doesn't remove the `tmp-abc123` entry, the user sees the task twice.

**Prevention:** After a successful POST, immediately replace `tmp-{uuid}` with the server-assigned `id` in local state before the next delta sync runs.

### Pitfall 6: MSAL token expiry during a long sync session

**What goes wrong:** Access tokens expire after 1 hour by default. A long-running SPA session silently fails Graph calls with 401 after the hour mark.

**Prevention:** Use MSAL's `acquireTokenSilent()` before every Graph call (or batch of calls). MSAL handles refresh token exchange automatically when the access token is expired. Do not cache the access token yourself.

### Pitfall 7: Personal Microsoft accounts vs. work/school accounts

**What goes wrong:** The `todoTask` delta endpoint and webhook subscriptions behave differently for personal Microsoft accounts vs. Azure AD (work/school) accounts. The `id` format differs, some features may be unavailable in specific national cloud deployments (e.g., China operated by 21Vianet doesn't support todoTask delta).

**Prevention:** Test with both account types if supporting both. Set `authority` in MSAL config appropriately. Check that `todoTask` webhooks note "only available in the global endpoint" (confirmed in official docs).

---

## 10. Recommended Architecture Sketch

```
Browser SPA
├── Auth layer (MSAL.js / @azure/msal-react)
│   └── acquireTokenSilent() before each Graph call
│
├── Graph API client (graphClient wrapper)
│   ├── Retry on 429 with Retry-After header
│   ├── Follow @odata.nextLink pagination
│   └── Return typed result sets
│
├── TanStack Query (server state)
│   ├── ['taskLists']        → useQuery: fetch all task lists
│   └── ['tasks', listId]    → useQuery: delta sync loop (interval + focus)
│       └── queryFn          → calls delta endpoint, merges into cache
│
├── Zustand (sync metadata + local-only state)
│   ├── deltaLinks[listId]   → persisted to localStorage
│   ├── lastSyncedAt[listId] → persisted to localStorage
│   ├── localEdits[taskId]   → in-memory (for conflict detection)
│   ├── pendingMutations[]   → in-memory (optimistic update tracking)
│   ├── offlineQueue[]       → in-memory (optionally localStorage)
│   └── syncStatus           → 'idle' | 'syncing' | 'error' | 'offline'
│
├── Mutation handlers (useMutation)
│   ├── onMutate  → snapshot previous state, apply optimistic update
│   ├── onError   → restore from snapshot, show error toast
│   └── onSettled → invalidate TanStack Query cache to trigger re-sync
│
└── Online/offline detection
    ├── navigator.onLine + 'online'/'offline' events
    └── On reconnect: replay offlineQueue, then trigger delta sync
```

---

## Sources

- [Delta query overview — Microsoft Graph](https://learn.microsoft.com/en-us/graph/delta-query-overview) (updated 2025-11-17)
- [todoTask: delta — Microsoft Graph v1.0](https://learn.microsoft.com/en-us/graph/api/todotask-delta) (updated 2025-11-13)
- [todoTask resource type — Microsoft Graph v1.0](https://learn.microsoft.com/en-us/graph/api/resources/todotask) (updated 2025-12-03)
- [Change notifications overview — Microsoft Graph](https://learn.microsoft.com/en-us/graph/change-notifications-overview) (updated 2025-09-10)
- [Throttling guidance — Microsoft Graph](https://learn.microsoft.com/en-us/graph/throttling) (updated 2025-08-06)
- [Best practices — Microsoft Graph](https://learn.microsoft.com/en-us/graph/best-practices-concept) (updated 2025-08-15)
- [SPA auth configuration — Microsoft identity platform](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-spa-app-configuration) (updated 2025-10-02)
- [Auth concepts — Microsoft Graph](https://learn.microsoft.com/en-us/graph/auth/auth-concepts) (updated 2025-08-06)
