---
area: Microsoft Graph API & To-do
researcher: gsd-project-researcher
date: 2026-03-26
---

# Microsoft Graph API & Microsoft To-do — Research Notes

**Confidence:** HIGH (all findings sourced from official Microsoft Learn documentation)

---

## 1. To-do API Endpoints

**Confidence: HIGH** — from official Graph docs (last updated Dec 2025 / Jan 2026)

### Base URL pattern

```
https://graph.microsoft.com/v1.0/me/todo/lists
https://graph.microsoft.com/v1.0/me/todo/lists/{todoTaskListId}/tasks
https://graph.microsoft.com/v1.0/me/todo/lists/{todoTaskListId}/tasks/{todoTaskId}
```

### Available operations on `todoTaskList`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/me/todo/lists` | List all task lists |
| POST | `/me/todo/lists` | Create a new task list |
| GET | `/me/todo/lists/{id}` | Get a specific list |
| PATCH | `/me/todo/lists/{id}` | Update list name |
| DELETE | `/me/todo/lists/{id}` | Delete a list |
| GET | `/me/todo/lists/delta` | Delta query for lists |

### Available operations on `todoTask`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/me/todo/lists/{id}/tasks` | List all tasks in a list |
| POST | `/me/todo/lists/{id}/tasks` | Create a task |
| GET | `/me/todo/lists/{id}/tasks/{taskId}` | Get a task |
| PATCH | `/me/todo/lists/{id}/tasks/{taskId}` | Update a task |
| DELETE | `/me/todo/lists/{id}/tasks/{taskId}` | Delete a task |
| GET | `/me/todo/lists/{id}/tasks/delta` | Delta query for tasks |

### `todoTask` properties (v1.0 — what you can read and write)

| Property | Type | Notes |
|----------|------|-------|
| `id` | String | Read-only. Changes when task moves between lists. |
| `title` | String | The task name |
| `body` | itemBody | Supports `text` and `html` contentType |
| `status` | taskStatus | `notStarted`, `inProgress`, `completed`, `waitingOnOthers`, `deferred` |
| `importance` | importance | `low`, `normal`, `high` |
| `dueDateTime` | dateTimeTimeZone | Due date with timezone |
| `startDateTime` | dateTimeTimeZone | Start date with timezone |
| `completedDateTime` | dateTimeTimeZone | When marked complete |
| `reminderDateTime` | dateTimeTimeZone | Reminder alert time |
| `isReminderOn` | Boolean | Whether alert is set |
| `recurrence` | patternedRecurrence | Recurrence pattern |
| `categories` | String[] | Maps to Outlook category displayNames |
| `hasAttachments` | Boolean | Read-only |
| `createdDateTime` | DateTimeOffset | Read-only |
| `lastModifiedDateTime` | DateTimeOffset | Read-only. Use this for polling-based sync. |
| `bodyLastModifiedDateTime` | DateTimeOffset | Read-only |

### `todoTaskList` properties

| Property | Type | Notes |
|----------|------|-------|
| `id` | String | Read-only |
| `displayName` | String | List name |
| `isOwner` | Boolean | True if current user owns it |
| `isShared` | Boolean | True if shared |
| `wellknownListName` | wellknownListName | `none`, `defaultList`, `flaggedEmails`, `unknownFutureValue` |

### What is NOT available via To-do API (v1.0)

- No subtask nesting beyond one level of `checklistItems`
- No list-level recurrence or scheduling
- No reading attachment content (only `hasAttachments: boolean`)
- `$filter` and `$orderby` support on delta is very limited (only `receivedDateTime` filters)
- No `$search` support on delta queries
- Not available in Microsoft Cloud China (21Vianet) for delta endpoints

---

## 2. OAuth2 PKCE Flow for SPAs (No Backend)

**Confidence: HIGH** — from official Microsoft Entra identity platform docs (updated Jan 2026)

### Why PKCE is mandatory for SPAs

SPAs are public clients — they cannot safely store a `client_secret`. PKCE replaces the client secret for public clients. Microsoft identity platform **requires** PKCE for SPA auth code flow.

### Required app registration step

In Azure Entra admin center (App Registrations), set the redirect URI type to **`spa`** (not `web`). This enables CORS from the browser to `login.microsoftonline.com/…/token`. Without `spa` type you get a CORS error when trying to redeem the auth code.

### Scopes required for To-do read/write

```
Tasks.ReadWrite     # delegated — for personal Microsoft accounts and work/school accounts
openid              # for ID token / user identity
offline_access      # for refresh token (required for silent token renewal)
```

`Tasks.ReadWrite` covers both reading and writing tasks and task lists. `Tasks.Read` is for read-only access. For a sync app, use `Tasks.ReadWrite`.

**No admin consent required** for `Tasks.ReadWrite` with delegated permissions on personal/work accounts.

### PKCE flow step-by-step

**Step 1 — Generate code verifier and challenge**
```javascript
// code_verifier: random 43–128 char string
const codeVerifier = generateRandomString(64);
// code_challenge: BASE64URL(SHA-256(code_verifier))
const codeChallenge = await sha256Base64Url(codeVerifier);
```

**Step 2 — Redirect to authorization endpoint**
```
GET https://login.microsoftonline.com/common/oauth2/v2.0/authorize
  ?client_id={APP_CLIENT_ID}
  &response_type=code
  &redirect_uri={REDIRECT_URI}          // must match registered spa redirect URI
  &response_mode=query
  &scope=openid offline_access Tasks.ReadWrite
  &state={RANDOM_STATE}
  &code_challenge={CODE_CHALLENGE}
  &code_challenge_method=S256
```

Use `common` as tenant for both personal and work accounts. Use a specific tenant ID for single-tenant apps.

**Step 3 — Receive authorization code at redirect URI**
```
http://localhost:3000/redirect?code={AUTH_CODE}&state={STATE}
```
Verify `state` matches what you sent.

**Step 4 — Exchange code for tokens (no client_secret needed)**
```
POST https://login.microsoftonline.com/common/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

client_id={APP_CLIENT_ID}
&code={AUTH_CODE}
&redirect_uri={REDIRECT_URI}
&grant_type=authorization_code
&code_verifier={CODE_VERIFIER}    // NOT the challenge — the original verifier
```

Response includes `access_token`, `refresh_token` (if `offline_access` requested), `id_token`.

**Step 5 — Token refresh**

Refresh tokens for SPAs expire after **24 hours**. This is a hard limit for `spa`-type redirect URIs due to browser privacy features (third-party cookie restrictions). After 24 hours, re-run the auth flow (usually silently in a hidden iframe or popup — no credential prompt if the user session is still active).

### Use MSAL.js — do not hand-roll

Microsoft recommends `@azure/msal-browser` (MSAL.js v2+) for SPAs. It handles PKCE, token caching, silent renewal, and the popup/redirect flows automatically.

```javascript
const msalConfig = {
  auth: {
    clientId: "YOUR_CLIENT_ID",
    authority: "https://login.microsoftonline.com/common",
    redirectUri: "https://yourapp.com/redirect",
  },
  cache: {
    cacheLocation: "sessionStorage",  // or "localStorage" for persistence
    storeAuthStateInCookie: false,    // set true only if you need IE11 support
  },
};
const msalInstance = new PublicClientApplication(msalConfig);
await msalInstance.initialize();
// Call handleRedirectPromise on every page load when using redirect flow
await msalInstance.handleRedirectPromise();
```

---

## 3. Two-Way Sync: Detecting Changes on MS To-do Side

**Confidence: HIGH** — from official Graph delta query docs (updated Nov 2025)

### Available change detection mechanisms

| Mechanism | Support for To-do | Notes |
|-----------|-------------------|-------|
| **Delta query (pull)** | YES — `todoTask` and `todoTaskList` | Recommended for SPAs |
| **Change notifications / webhooks (push)** | YES — `todoTask` only | Requires a public HTTPS endpoint; hard for pure SPAs |
| **Polling full collection** | YES but inefficient | Triggers throttling at volume |

### Delta query: the recommended pattern

Delta query is a pull model — your app calls Graph on a schedule and receives only what changed. It is the right choice for SPAs where you cannot maintain a persistent webhook listener.

**Full delta cycle:**

```
Round 1 (initial sync):
GET /me/todo/lists/{listId}/tasks/delta
→ Response: { value: [...all tasks...], "@odata.nextLink": "...?$skiptoken=AAA" }

GET ...?$skiptoken=AAA
→ Response: { value: [...more tasks...], "@odata.nextLink": "...?$skiptoken=BBB" }

GET ...?$skiptoken=BBB
→ Response: { value: [...last page...], "@odata.deltaLink": "...?$deltatoken=XYZ" }
  ↑ This is the end of the initial sync. Save this deltaLink URL.

Round 2+ (incremental sync):
GET ...?$deltatoken=XYZ
→ Response: { value: [...only changed tasks since last sync...], "@odata.deltaLink": "...?$deltatoken=NEW" }
  - New tasks: appear as full objects
  - Updated tasks: appear with id + changed properties only (not all properties)
  - Deleted tasks: appear as { "id": "...", "@removed": { "reason": "deleted" } }
```

**Key rules:**
- Never modify the `@odata.nextLink` or `@odata.deltaLink` URL — they embed all query parameters.
- When you receive `@odata.deltaLink`, the sync round is complete. Save the full URL.
- When you next sync, start with the saved `@odata.deltaLink` URL.

**Delta for task lists:**
```
GET /me/todo/lists/delta
```
Same pattern — detects added, updated, deleted lists. Run this before syncing tasks to catch new or removed lists.

**Handling `410 Gone` response:**
If Graph returns `410 Gone`, the delta token has expired or state was reset. Start over with a full sync (drop the saved deltaLink, begin from scratch).

### Delta token validity for To-do

Delta tokens for Outlook entities (including `todoTask` and `todoTaskList`) do **not** have a fixed expiry. They expire when pushed out of the internal cache. In practice, tokens can last days to weeks — but you should handle the `410 Gone` case defensively. The token cache is rolling; very old tokens expire first.

### Combine webhooks + delta for near-real-time sync (optional)

Webhooks for `todoTask` are supported (`/me/todo/lists/{id}/tasks`). Maximum subscription lifetime is **4,230 minutes (~3 days)**. Subscriptions must be renewed before expiry. The notification only delivers basic change info (task ID), not the full payload — you then fetch the delta or the specific task. **Important:** webhooks require a public HTTPS endpoint, making them unsuitable for a pure SPA without a backend. For SPAs, use polling with delta query.

**Recommended polling interval for SPA:** Every 30–60 seconds for active-use scenarios; every 5 minutes for background sync.

### Supported query params on To-do delta

```
$select        — return specific fields only (id always included)
$top           — page size hint (server may return different count)
$expand        — expand linked relationships
$filter        — ONLY receivedDateTime ge/gt {value}
$orderby       — ONLY receivedDateTime desc
$search        — NOT SUPPORTED
```

---

## 4. Flagged Email Tasks in Outlook

**Confidence: HIGH** — from official todoTaskList resource docs (Dec 2025)

### How flagged emails appear in the To-do API

When a user flags an email in Outlook, it automatically appears as a task in Microsoft To-do. The API exposes this through a special built-in list:

```json
{
  "wellknownListName": "flaggedEmails",
  "displayName": "Flagged Email",
  "isOwner": true,
  "isShared": false
}
```

**To find the flagged emails list:**
```
GET /me/todo/lists
```
Filter the response for `wellknownListName == "flaggedEmails"`. The `id` of this list changes per user and cannot be hardcoded.

**To read flagged email tasks:**
```
GET /me/todo/lists/{flaggedEmailsListId}/tasks
```

### Properties specific to flagged email tasks

Flagged email tasks appear as standard `todoTask` objects. The connection back to the source email is stored in `linkedResources`:

```json
{
  "id": "task-id",
  "title": "Subject of the email",
  "linkedResources": [
    {
      "applicationName": "Outlook",
      "displayName": "Subject of the email",
      "externalId": "{outlook-message-id}",
      "webUrl": "https://outlook.office365.com/mail/..."
    }
  ]
}
```

### Critical constraints on flagged email tasks

1. **The flaggedEmails list cannot be renamed or deleted** via the API. Any PATCH to `displayName` or DELETE on this list will fail.

2. **Tasks in the flaggedEmails list are linked to real emails.** Deleting the task via the To-do API un-flags the email. Creating a new task in the flaggedEmails list via the API is technically possible but creates a "floating" task not connected to any email.

3. **You cannot move tasks out of or into the flaggedEmails list** using the standard To-do API. (Task IDs change on move; there is no explicit move endpoint — you must delete and recreate.)

4. **To get the `linkedResource` data**, you must explicitly expand or query it:
```
GET /me/todo/lists/{id}/tasks?$expand=linkedResources
```
Or separately:
```
GET /me/todo/lists/{id}/tasks/{taskId}/linkedResources
```

5. **The `title` of a flagged email task is the email subject.** If you PATCH the `title`, it changes only the To-do task name; it does not change the email subject.

6. **Completing the To-do task does not mark the email as read** or move it — it only removes the flag. The reverse is also true: clearing the flag in Outlook removes the task from To-do.

### `linkedResource` properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | String | Server-generated ID |
| `applicationName` | String | e.g., "Outlook" |
| `displayName` | String | Title of the source item |
| `externalId` | String | The source item's ID in the originating app |
| `webUrl` | String | Deep link back to the source (nullable) |

---

## 5. Rate Limits and Throttling

**Confidence: MEDIUM** — specific per-service limits for Tasks not published; general Graph throttling behavior is HIGH confidence.

### When throttling occurs

Microsoft Graph returns `HTTP 429 Too Many Requests` when limits are exceeded. The response includes:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 10

{
  "error": {
    "code": "TooManyRequests",
    "message": "Please retry again later."
  }
}
```

### Handling throttling correctly

1. **Always check for `429` responses.**
2. **Read the `Retry-After` header** — it contains the exact number of seconds to wait.
3. **Wait the specified time, then retry.** Do not retry immediately.
4. If no `Retry-After` header: use exponential backoff (e.g., 1s, 2s, 4s, 8s…).
5. MSAL.js and Microsoft Graph SDKs handle `Retry-After` automatically.

### Throttling scope headers (check these for diagnostics)

- `x-ms-throttle-limit-percentage` — current usage percentage
- `x-ms-throttle-scope` — which limit scope was exceeded
- `Retry-After` — wait time in seconds

### General service limits (Tasks falls under Outlook/personal productivity)

Microsoft does not publish exact RPS limits for the Tasks API publicly. Outlook-family services share resource unit pools:

- Requests are measured in resource units per time window
- Write operations consume more resource units than reads
- Limits apply per app+tenant combination, and globally per app

### Best practices to stay under limits

- Use **delta query** instead of polling full collections — it is significantly cheaper.
- Use **`$select`** to request only needed properties.
- Use **`$top`** to control page size.
- Batch non-related reads using **JSON batching** (`POST /v1.0/$batch`) — but note each request within a batch still counts against throttling individually.
- Avoid patterns that poll the same resource repeatedly in short windows.
- For bulk data extraction needs, use **Microsoft Graph Data Connect** instead of the REST API.

### Webhook subscription limits for todoTask

- Maximum subscription lifetime: **4,230 minutes (~3 days)**
- Subscriptions must be renewed before expiry
- Webhooks for todoTask are **only available on the global endpoint** (not national clouds)
- No published limit on number of subscriptions per user for todoTask

### Change notification latency (todoTask)

- Average: **less than 2 minutes**
- Maximum: **15 minutes**

---

## 6. Common Gotchas for MS To-do Integrations

**Confidence: MEDIUM–HIGH** — derived from official documentation, API behavior descriptions, and known constraints.

### Gotcha 1: Task IDs are not stable across list moves

The `id` of a `todoTask` **changes when the task is moved from one list to another**. There is no explicit "move task" endpoint — moving requires deleting from the source and creating in the destination. If your sync logic uses task IDs as stable foreign keys, you will lose the mapping when tasks are moved. Mitigation: use `linkedResource.externalId` to store your own stable cross-reference ID.

### Gotcha 2: SPA refresh tokens expire in 24 hours

For `spa`-type redirect URIs, refresh tokens expire after exactly **24 hours** regardless of user activity. This is a hard platform limit introduced to address browser privacy concerns around third-party cookies. Your app must re-run the authorization flow at least every 24 hours. MSAL.js handles this with a silent `acquireTokenSilent` call (uses a hidden iframe or popup). Design your app to handle `interaction_required` errors gracefully and prompt re-authentication.

### Gotcha 3: Delta tokens expire without warning

The `@odata.deltaLink` token for To-do entities expires when evicted from the server-side cache (no fixed TTL). When expired, Graph returns `410 Gone`. Your sync engine must handle this by falling back to a full initial sync. Do not assume the deltaLink is perpetually valid.

### Gotcha 4: Updated tasks return partial properties

In a delta response, **updated tasks only return changed properties** (plus `id`). You cannot assume all properties are present. Always merge delta results into your local copy rather than replacing the entire object.

### Gotcha 5: The flaggedEmails list ID varies per user

The `wellknownListName: "flaggedEmails"` list exists for every user, but its `id` is unique per user. You must call `GET /me/todo/lists` on first run and find the list by `wellknownListName`. Cache the ID but be prepared to re-fetch if it ever becomes stale.

### Gotcha 6: Cannot delete or modify built-in lists

The two built-in lists (`defaultList` with `wellknownListName: "defaultList"` and `flaggedEmails`) **cannot be renamed or deleted** via the API. Attempts return errors. Trying to delete the default Tasks list is a common source of unexpected 4xx errors in integrations.

### Gotcha 7: `linkedResources` are not returned by default

When listing tasks, `linkedResources` are a navigation property — they are **not included in the default response**. You must explicitly `$expand=linkedResources` or make a separate request. This matters critically for flagged email tasks where the Outlook email link lives in `linkedResources`.

### Gotcha 8: SPA redirect URI must be type `spa`, not `web`

If you register a redirect URI as type `web` instead of `spa` in Azure Entra, the PKCE auth code flow will fail with a CORS error when the browser tries to POST to the `/token` endpoint. The `spa` type enables CORS support. This is a one-time app registration mistake that is not obvious from the error message.

### Gotcha 9: `Tasks.ReadWrite` is needed even for read operations in some contexts

The delta function docs list `Tasks.ReadWrite` as the minimum permission for the task list delta endpoint. `Tasks.Read` alone is insufficient for `todoTaskList: delta`. Use `Tasks.ReadWrite` for all To-do operations to avoid scope-related failures.

### Gotcha 10: Webhooks require a public HTTPS endpoint

Change notifications for `todoTask` are delivered to a caller-provided HTTPS URL. In a pure SPA (no backend), there is nowhere to receive push notifications. The correct approach for SPAs is **polling with delta query**. If near-real-time sync is required, a lightweight backend (Azure Function, etc.) is needed to receive webhooks and relay changes.

### Gotcha 11: `$filter` on task list is not supported in delta

The delta query for `todoTask` only supports `$filter=receivedDateTime+ge+{value}` or `receivedDateTime+gt+{value}`. Standard OData filters on other fields (e.g., `status`, `dueDateTime`) are not supported in the delta endpoint.

### Gotcha 12: `dateTimeTimeZone` fields require specific format

Fields like `dueDateTime`, `startDateTime`, `reminderDateTime` use the `dateTimeTimeZone` type, not a simple ISO string:

```json
{
  "dueDateTime": {
    "dateTime": "2026-04-01T00:00:00.0000000",
    "timeZone": "UTC"
  }
}
```

Passing a plain ISO string will result in a validation error.

---

## 7. Summary Recommendations for This Project

| Concern | Recommendation |
|---------|----------------|
| Auth library | Use `@azure/msal-browser` (MSAL.js v2+), do not hand-roll PKCE |
| Required scope | `Tasks.ReadWrite openid offline_access` |
| Change detection | Delta query on a timer (30–60s active, 5min background) |
| Flagged emails | Query all lists, find `wellknownListName == "flaggedEmails"`, cache the list ID |
| Stable task reference | Store your own ID in `linkedResource.externalId` to survive task moves |
| Token storage | `sessionStorage` (more secure) or `localStorage` (more persistent); never `cookie` for secrets |
| Throttle handling | Always honor `Retry-After`; implement exponential backoff fallback |
| Delta token expiry | Handle `410 Gone` → full re-sync |
| `dateTimeTimeZone` | Always send as `{ dateTime: "...", timeZone: "UTC" }` object |
| Webhook vs polling | Use polling for SPA; webhooks require a backend endpoint |

---

## Sources

- [todoTask resource type (v1.0)](https://learn.microsoft.com/en-us/graph/api/resources/todotask?view=graph-rest-1.0) — updated Dec 2025
- [todoTaskList resource type (v1.0)](https://learn.microsoft.com/en-us/graph/api/resources/todotasklist?view=graph-rest-1.0) — updated Dec 2025
- [todoTask: delta (v1.0)](https://learn.microsoft.com/en-us/graph/api/todotask-delta?view=graph-rest-1.0) — updated Nov 2025
- [todoTaskList: delta (v1.0)](https://learn.microsoft.com/en-us/graph/api/todotasklist-delta?view=graph-rest-1.0) — updated Nov 2025
- [linkedResource resource type (v1.0)](https://learn.microsoft.com/en-us/graph/api/resources/linkedresource?view=graph-rest-1.0)
- [To Do API overview](https://learn.microsoft.com/en-us/graph/todo-concept-overview) — updated Aug 2025
- [Use the Microsoft To Do API (v1.0)](https://learn.microsoft.com/en-us/graph/api/resources/todo-overview?view=graph-rest-1.0)
- [OAuth 2.0 authorization code flow (PKCE)](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow) — updated Jan 2026
- [Initialize MSAL.js client apps](https://learn.microsoft.com/en-us/entra/identity-platform/msal-js-initializing-client-applications) — updated May 2025
- [Delta query overview](https://learn.microsoft.com/en-us/graph/delta-query-overview) — updated Nov 2025
- [Change notifications overview](https://learn.microsoft.com/en-us/graph/change-notifications-overview) — updated Sep 2025
- [Microsoft Graph throttling guidance](https://learn.microsoft.com/en-us/graph/throttling) — updated Jan 2025
