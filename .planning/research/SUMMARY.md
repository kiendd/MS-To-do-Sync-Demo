# Project Research Summary

**Project:** MS To-do Sync Demo
**Domain:** Browser SPA — Microsoft Graph API integration, two-way task sync
**Researched:** 2026-03-26
**Confidence:** HIGH (all critical findings sourced directly from official Microsoft documentation)

---

## Executive Summary

This is a browser-only single-page application that authenticates with Microsoft Entra ID via OAuth2 PKCE and performs two-way task synchronization against the Microsoft To-do service through the Microsoft Graph API. The architecture is entirely client-side — no backend server, no webhook receivers, no server-side secrets. This constraint is well-supported by the Graph API but demands a specific set of choices: delta query polling instead of webhooks for change detection, MSAL.js (not hand-rolled PKCE) for auth, and a disciplined state split between TanStack Query (server state) and Zustand (sync metadata + UI state).

The recommended approach is a four-layer architecture: MSAL React for auth token lifecycle, a typed Graph API client wrapper for HTTP + retry, TanStack Query for caching and polling, and Zustand for deltaLink persistence and optimistic mutation tracking. The Graph delta query mechanism is the backbone — on each 30-second poll interval, the app submits its stored deltaLink and receives only what changed, making it cheap and throttling-safe. Writes are applied optimistically with rollback on failure. Conflict resolution uses a last-write-wins strategy guarded by `lastModifiedDateTime` comparison, which is the most practical approach given that Graph provides no ETag-based conditional writes for To-do tasks.

The primary risks are implementation-level gotchas that are invisible until you hit them: task IDs change when tasks move between lists (breaking stable foreign keys), datetime fields require a `dateTimeTimeZone` object not a plain ISO string, the SPA refresh token has a hard 24-hour expiry, the deltaLink must be stored as a complete opaque URL and handled for `410 Gone`, and `offline_access` must be requested at initial login or refresh tokens will not be issued. None of these risks are architectural blockers — they are known API behaviors that can be addressed with correct implementation patterns from the start.

---

## Key Findings

### Recommended Stack

The stack is unified and has no controversial choices. React is the only framework with official Microsoft support (`@azure/msal-react`); Vue and Svelte have community-only MSAL wrappers. MSAL.js v5 (`@azure/msal-browser` 5.4.0, `@azure/msal-react` 5.0.6) is the current active version — v3 and v4 are out of active support. Vite 6.x replaces Create React App (officially deprecated). shadcn/ui provides a copy-owned component layer built on Radix UI primitives and Tailwind CSS, appropriate for a daily-use productivity app.

Note: The frontend-stack.md research table lists `@azure/msal-react` as 2.x, but msal-auth.md (the dedicated MSAL research) confirms the current active version is v5. Use v5 for both `@azure/msal-browser` and `@azure/msal-react`.

**Core technologies:**

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Framework | React + TypeScript | 18.x / 5.x | Only framework with official MSAL package; Graph types via `@microsoft/microsoft-graph-types` |
| Build | Vite | 6.x | CRA is deprecated; near-instant dev server, standard SPA build |
| Auth | `@azure/msal-browser` + `@azure/msal-react` | v5.x | Official Microsoft package; handles PKCE, token cache, silent renewal, popup flow |
| UI | shadcn/ui + Tailwind CSS + Lucide | CLI-based | Owned component code, Radix accessibility, dark mode built-in |
| Server state | TanStack Query | v5 | `useQuery` polling + `useMutation` optimistic updates map directly to Graph API pattern |
| UI / sync state | Zustand | v4 | Minimal store for deltaLinks, lastSyncedAt, pendingMutations, syncStatus |
| Graph types | `@microsoft/microsoft-graph-types` | latest | Zero-runtime, full types for `TodoTask`, `TodoTaskList` |
| DnD | dnd-kit | v6 | react-beautiful-dnd is abandoned; defer DnD to v2 — To-do uses `orderDateTime` not integer positions |

### Expected Features

**Must have (table stakes — in scope per PROJECT.md):**
- Microsoft account sign-in via OAuth2 PKCE — users cannot access Graph without this
- Task list sidebar showing all user lists, including the "Flagged Email" well-known list
- Full CRUD on tasks: create, read, update (title, status, importance), delete, mark complete
- Two-way delta sync — changes in either the app or native MS To-do surface in both within ~30 seconds
- Flagged email tasks displayed inline alongside regular tasks — no separate UI section
- Responsive web UI usable as a daily driver

**Should have (quality of life for daily use):**
- Optimistic updates — writes feel instant; rollback on API failure with toast notification
- Sync status indicator — last synced timestamp, "syncing" / "offline" / "error" states
- Visual distinction for flagged email tasks (Outlook origin badge) without separate list UI
- Token renewal handled silently — no mid-session login interruptions
- 410 Gone recovery — auto-restart full sync with user-visible "Re-syncing" indicator

**Defer to v2+:**
- Drag-and-drop task reordering — requires `orderDateTime` arithmetic, not trivial; not in core scope
- Due date / reminder display and editing — explicitly out of scope in PROJECT.md
- Offline mode with queued writes — PROJECT.md notes connectivity is required
- Subtask (checklistItems) display
- Multi-list task creation flow

### Architecture Approach

The application follows a layered pull-based sync architecture. MSAL React wraps the app at root level and provides token acquisition hooks used at the data-fetch layer. A typed Graph API client wrapper handles Bearer token injection, `429 Retry-After` handling, and `@odata.nextLink` pagination. TanStack Query owns the server state cache keyed by `['taskLists']` and `['tasks', listId]`, drives the 30-second delta poll via `refetchInterval`, and pauses polling when the tab is hidden (`refetchIntervalInBackground: false`). Zustand persists `deltaLinks` and `lastSyncedAt` to `localStorage` and holds transient sync metadata in memory. Mutations use TanStack Query's `onMutate`/`onError`/`onSettled` lifecycle for optimistic updates and rollback.

**Major components:**

1. **Auth layer** (`features/auth`) — MSAL `PublicClientApplication` instance (singleton), `MsalProvider` root wrapping, `useGraphToken` hook abstracting `acquireTokenSilent` + popup fallback, `AuthGuard` for route protection
2. **Graph API client** (`features/*/api/*.api.ts`) — typed fetch wrappers per resource, `Retry-After` enforcement, full `@odata.nextLink` pagination loop, `410 Gone` detection
3. **Task list feature** (`features/task-lists`) — `useTaskLists` query, list delta sync, `wellknownListName` detection for flagged email list
4. **Tasks feature** (`features/tasks`) — `useTasks` query with delta sync loop, `useMutation` hooks for CRUD, optimistic update/rollback logic, conflict guard via `lastModifiedDateTime`
5. **Sync store** (Zustand) — `deltaLinks[listId]`, `lastSyncedAt[listId]`, `localEdits[taskId]`, `pendingMutations[]`, `syncStatus`
6. **UI store** (Zustand) — `selectedListId`, `activeFilter`, `sidebarOpen`, `theme`

### Critical Pitfalls

These are confirmed API behaviors that will break implementation if not addressed from the start:

1. **Task IDs change on list move** — The `todoTask.id` is not a stable identifier across list moves. There is no Move endpoint; moves require DELETE + POST. If sync logic uses task ID as a stable foreign key, mappings break silently. Mitigation: use `linkedResource.externalId` for any cross-reference that must survive list moves; treat task IDs as ephemeral within-list identifiers.

2. **`dateTimeTimeZone` is an object, not a string** — Fields like `dueDateTime`, `startDateTime`, and `reminderDateTime` require `{ "dateTime": "2026-04-01T00:00:00.0000000", "timeZone": "UTC" }`. Passing a plain ISO string fails with a validation error. Mitigation: define a `toGraphDateTime(isoString)` helper used in every PATCH/POST payload.

3. **SPA refresh token expires after 24 hours (hard limit)** — For `spa`-type redirect URIs, refresh tokens do not slide; they expire exactly 24 hours after issuance. MSAL handles renewal via `acquireTokenSilent` using a hidden iframe (SSO session cookie). If the iframe fails (Safari ITP, Firefox ETP blocking third-party cookies), `InteractionRequiredAuthError` is thrown and the user must interact. Mitigation: always call `acquireTokenSilent` before each Graph call batch; handle `InteractionRequiredAuthError` by falling back to `acquireTokenPopup`.

4. **deltaLink must be stored as a complete opaque URL** — Extracting only the `$deltatoken` parameter value from `@odata.deltaLink` and attempting to reconstruct the URL will break. Graph embeds encoded query parameters inside the token. Store and reuse the entire URL string. When Graph returns `410 Gone` or `syncStateNotFound`, discard the stored deltaLink and begin a full sync.

5. **`offline_access` scope must be requested at login time** — If omitted from the initial login request, MSAL does not receive a refresh token. After the 1-hour access token expires, every Graph call fails silently with 401 and requires interactive re-auth. Mitigation: include `offline_access` in `todoLoginRequest.scopes` from day one. It cannot be added to an existing session without re-login.

6. **`flaggedEmails` list ID is per-user, not hardcodeable** — The list with `wellknownListName: "flaggedEmails"` exists for every user but has a unique `id` per account. Call `GET /me/todo/lists`, filter by `wellknownListName === "flaggedEmails"`, and cache the result. This must happen before any task queries can run.

7. **Delta responses return partial objects for updates** — Updated tasks in a delta response include only `id` plus changed fields, not the full task. Merging delta results must patch the existing cache entry, not replace the whole object. Replacing the whole object will silently zero out unchanged fields.

---

## Implications for Roadmap

Based on combined research, the natural dependency ordering and risk profile suggest 4 phases.

### Phase 1: Foundation — Auth + Project Scaffold

**Rationale:** Nothing else can run without a valid access token and a working Graph API connection. Auth is the prerequisite for every subsequent phase. Getting the Azure App Registration right (SPA platform type, not Web) eliminates the CORS pitfall that blocks all development if done wrong.

**Delivers:**
- Vite + React + TypeScript scaffold with MSAL v5 configured
- Azure App Registration set up as Single-page Application type with `Tasks.ReadWrite offline_access openid` scopes
- `MsalProvider` root, `loginPopup` flow, `acquireTokenSilent` + popup fallback pattern
- Basic Graph API client wrapper (token injection, 429 retry, typed responses)
- User profile display (account name, sign-out button) confirming auth is working
- `@microsoft/microsoft-graph-types` installed; raw `/me/todo/lists` call succeeding

**Avoids:** CORS error from wrong redirect URI type; missing `offline_access` at login time causing 1-hour session expiry.

**Research flag:** Standard patterns — MSAL v5 and PKCE are fully documented. No additional research phase needed.

---

### Phase 2: Read — Task Lists + Tasks Display

**Rationale:** Establishing a working read path with delta sync as the data layer is more valuable than building CRUD without it. Starting with delta query rather than simple GET prevents having to retrofit the sync mechanism later. This phase also surfaces the `flaggedEmails` list detection which must precede any display of those tasks.

**Delivers:**
- Task list sidebar fetching all user lists via `GET /me/todo/lists/delta`
- `wellknownListName: "flaggedEmails"` detection and list ID caching on first load
- Task query for selected list via `GET /me/todo/lists/{id}/tasks/delta` (full initial sync + deltaLink storage)
- TanStack Query `['taskLists']` and `['tasks', listId]` query keys established
- Zustand sync store with `deltaLinks` persisted to `localStorage`
- 30-second polling loop (`refetchInterval: 30_000`, `refetchIntervalInBackground: false`)
- `410 Gone` detection triggering full re-sync
- Sync status indicator (last synced time, error state)
- Flagged email tasks displayed inline in the list view (no separate UI section)

**Avoids:** Pitfall of storing partial deltaLink token instead of full URL; pitfall of not paginating `@odata.nextLink`; pitfall of not detecting flagged email list at runtime.

**Research flag:** Standard patterns for delta query are fully documented. The `orderDateTime` task ordering behavior warrants a quick Graph Explorer test to confirm behavior before rendering the task list in sorted order.

---

### Phase 3: Write — CRUD + Optimistic Updates

**Rationale:** With a stable read path established, writes can be layered on top cleanly. Optimistic updates are easier to implement correctly when the underlying cache structure is already working. The `dateTimeTimeZone` format issue and the `tmp-id` deduplication problem after POST both need to be solved here before they cause data integrity issues.

**Delivers:**
- Create task (`POST /me/todo/lists/{id}/tasks`) with optimistic add + `tmp-{uuid}` ID replacement on server response
- Update task title and status (`PATCH /me/todo/lists/{id}/tasks/{taskId}`) with optimistic update + rollback on failure
- Delete task (`DELETE /me/todo/lists/{id}/tasks/{taskId}`) with optimistic removal + restore on failure
- Mark task complete/incomplete (status field via PATCH)
- `toGraphDateTime()` helper for all date field payloads
- `useMutation` `onMutate`/`onError`/`onSettled` lifecycle for all write operations
- Toast notifications for write failures
- Conflict guard: `lastModifiedDateTime` comparison before applying delta update over a locally edited task

**Avoids:** `dateTimeTimeZone` format validation errors; duplicate entries from optimistic creates; silent data loss from replacing full task objects with partial delta updates.

**Research flag:** Standard TanStack Query mutation patterns. No additional research needed.

---

### Phase 4: Polish — Two-Way Sync Validation + UX Hardening

**Rationale:** End-to-end two-way sync validation (making changes in the native MS To-do app or Outlook and confirming they appear in the web app within 30 seconds) must happen as a dedicated phase because edge cases in delta merge, conflict resolution, and 24-hour token renewal are only discoverable with real usage. UI hardening and responsive layout complete the "daily driver" goal from PROJECT.md.

**Delivers:**
- End-to-end two-way sync tested: app-to-Graph and Graph-to-app change propagation
- Token renewal validation: 24-hour session tested; `InteractionRequiredAuthError` popup flow working
- `410 Gone` recovery tested with expired deltaLink
- Flagged email task creation (from Outlook flag) surfacing in app within one poll cycle
- Responsive layout for mobile/tablet (the PROJECT.md requirement for "daily use")
- Dark mode via shadcn/ui `ThemeProvider` pattern
- Empty states, loading skeletons, error boundaries
- Performance: `$select` applied to delta queries to reduce payload size

**Avoids:** Silent regression on token renewal breaking long-running sessions; edge cases in delta merge going undetected before daily use.

**Research flag:** No additional research needed. This phase is integration testing and polish.

---

### Phase Ordering Rationale

- Auth must be Phase 1 — it is a hard dependency for all Graph API calls. Getting the Azure App Registration wrong blocks everything.
- Read before Write — the delta sync cache structure must exist before mutations write into it. Retrofitting optimistic updates onto a simple `useState` fetch is harder than building mutations on top of an existing TanStack Query cache.
- Poll before CRUD — delta query is the architectural backbone, not an add-on. Treating sync as foundational (Phase 2) rather than an afterthought prevents the common mistake of building a simple fetch-on-load app and trying to add two-way sync later.
- Polish last — two-way sync validation requires real usage data that only emerges from a working CRUD implementation.

### Research Flags

Phases with standard patterns (no additional research-phase needed):
- **Phase 1:** MSAL v5 + PKCE + Azure App Registration are completely documented
- **Phase 3:** TanStack Query mutation patterns are well-established
- **Phase 4:** Integration testing and UI polish — no novel API territory

Verify during Phase 2 (not a blocker, but test before committing to implementation):
- **`orderDateTime` behavior:** How MS To-do orders tasks and whether the API preserves user-defined order needs a quick Graph Explorer test. This affects task list sort order in the UI but does not affect sync correctness.
- **shadcn/ui + Tailwind CSS version:** The research notes shadcn/ui was in active transition to Tailwind v4 as of Aug 2025. Check current install instructions at `https://ui.shadcn.com/docs/installation/vite` before scaffolding.

---

## Open Questions

These questions do not block starting Phase 1 but should be answered before or during Phase 2:

1. **Which Microsoft account type will the demo use?** Personal Microsoft accounts (Outlook/Hotmail) vs. work/school (Azure AD) accounts affect the MSAL `authority` setting (`/common` for both, `/consumers` for personal only) and the available To-do features. Flagged email tasks only exist meaningfully for accounts with Outlook access.

2. **Does the target test account have existing MS To-do lists?** If yes, initial delta sync may paginate across many items. Plan `$top` and `@odata.nextLink` handling before first demo.

3. **Is Tailwind CSS v3 or v4 the current shadcn/ui target?** The research flagged this as in-flux. Check `https://ui.shadcn.com` before `npm create vite`.

4. **Will the app be deployed or local-only?** PROJECT.md says local is sufficient, but if deployment is desired, the production redirect URI needs to be registered in Azure App Registration before the demo.

5. **`orderDateTime` behavior in Graph API** — Does `GET /me/todo/lists/{id}/tasks` return tasks in the user's preferred order, and does PATCH to `orderDateTime` work as expected? Test in Graph Explorer before building sort logic.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Auth (MSAL v5, PKCE, App Registration) | HIGH | All findings from official Microsoft Entra docs, Jan 2026 |
| Graph API endpoints and properties | HIGH | Official Graph v1.0 docs, Dec 2025 / Nov 2025 |
| Delta query mechanics | HIGH | Official delta query overview, Nov 2025 |
| Flagged email list behavior | HIGH | Official todoTaskList resource docs, Dec 2025 |
| Throttling behavior | MEDIUM | Specific Tasks API limits not published; general Graph behavior is HIGH confidence |
| Frontend stack (React, Vite, TanStack Query, Zustand) | HIGH | All mature, stable libraries through Aug 2025 cutoff |
| shadcn/ui + Tailwind version compatibility | LOW | Was in active transition near cutoff — verify before scaffolding |
| TanStack Query v5 `useMutation` API shape | HIGH | v5 was stable and released through cutoff |
| `orderDateTime` task ordering details | MEDIUM | Based on Graph docs; behavior should be verified in Graph Explorer |

**Overall confidence: HIGH**

The core technical risks are all known and documented. There are no unknown unknowns in the architecture — the risks are implementation-level gotchas with clear prevention strategies, not architectural uncertainties.

### Gaps to Address

- **shadcn/ui + Tailwind version:** Check `https://ui.shadcn.com/docs/installation/vite` before project scaffold. Use whatever version the CLI targets as of today.
- **MSAL React version number:** The frontend-stack.md research lists `@azure/msal-react` 2.x in its table, but msal-auth.md (the dedicated research) confirms v5 is current. Install v5 for both packages. The table in frontend-stack.md was a secondary detail and is superseded by the dedicated MSAL research.
- **Throttling limits for Tasks API:** Microsoft does not publish exact RPS limits for the Tasks service. The 30-second poll interval is conservative and should stay well within headroom. Monitor `x-ms-throttle-limit-percentage` headers in development.

---

## Sources

### Primary (HIGH confidence — official Microsoft documentation)

- [todoTask resource type v1.0](https://learn.microsoft.com/en-us/graph/api/resources/todotask) — updated Dec 2025
- [todoTaskList resource type v1.0](https://learn.microsoft.com/en-us/graph/api/resources/todotasklist) — updated Dec 2025
- [todoTask: delta v1.0](https://learn.microsoft.com/en-us/graph/api/todotask-delta) — updated Nov 2025
- [todoTaskList: delta v1.0](https://learn.microsoft.com/en-us/graph/api/todotasklist-delta) — updated Nov 2025
- [Delta query overview](https://learn.microsoft.com/en-us/graph/delta-query-overview) — updated Nov 2025
- [Change notifications overview](https://learn.microsoft.com/en-us/graph/change-notifications-overview) — updated Sep 2025
- [Microsoft Graph throttling guidance](https://learn.microsoft.com/en-us/graph/throttling) — updated Jan 2025
- [OAuth 2.0 Auth Code + PKCE flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow) — updated Jan 2026
- [MSAL.js overview and version table](https://learn.microsoft.com/en-us/javascript/api/overview/msal-overview)
- [MSAL Browser v5 overview](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/about-msal-browser)
- [MSAL Browser token lifetimes](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/token-lifetimes)
- [MSAL Browser errors reference](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/errors)
- [MSAL React getting started](https://learn.microsoft.com/en-us/entra/msal/javascript/react/getting-started)
- [SPA app code configuration](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-spa-app-configuration)
- [App registration quickstart](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
- [Microsoft Graph Tasks permissions](https://learn.microsoft.com/en-us/graph/permissions-reference#tasks-permissions)

### Secondary (MEDIUM confidence — community consensus / established patterns)

- TanStack Query v5 documentation — `useQuery` + `useMutation` patterns for Graph API
- Zustand v4 documentation — store patterns for sync metadata
- shadcn/ui documentation — component model and Tailwind integration
- Feature-based folder structure — strong community consensus for React SPAs, not framework-prescribed

---

*Research completed: 2026-03-26*
*Ready for roadmap: yes*
