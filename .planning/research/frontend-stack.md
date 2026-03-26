---
area: Frontend Stack
researcher: gsd-project-researcher
date: 2026-03-26
---

# Frontend Stack Research: MS To-do Sync Demo

**Domain:** React SPA connecting to Microsoft Graph API
**Researched:** 2026-03-26
**Overall Confidence:** HIGH (ecosystem was mature and stable through Aug 2025 cutoff; no live web verification was possible in this environment — findings are based on training data cross-checked against known stable library versions)

---

## 1. Framework: React vs Vue vs Svelte

### Recommendation: React

**Use React.** Not because it is objectively "best," but because the decision criteria for this specific project all point to it.

### Decision Matrix

| Criterion | React | Vue | Svelte |
|-----------|-------|-----|--------|
| MSAL.js official support | YES (`@azure/msal-react`) | Community wrapper only | Community wrapper only |
| TanStack Query integration | First-class | Good | Exists (`@tanstack/svelte-query`) |
| shadcn/ui availability | YES (native) | `shadcn-vue` (port) | `shadcn-svelte` (port) |
| Ecosystem maturity | Largest | Large | Growing |
| Hiring / community for a demo | Easiest to hand off | Good | Smaller pool |
| Bundle size overhead | Higher | Medium | Lowest |
| Prototype velocity | Fast | Fast | Fast |

### Why React Wins Here

1. **MSAL is first-class.** Microsoft ships `@azure/msal-react` as an official package with React hooks (`useMsal`, `useAccount`, `useMsalAuthentication`). Vue and Svelte integrations are community-maintained wrappers. For a Graph API project this is the most important dependency — use the one Microsoft supports directly.

2. **The full preferred stack (shadcn/ui + TanStack Query + Zustand + dnd-kit) was designed for React.** Each of those libraries has React as its primary target. Using Vue or Svelte means using ports or alternatives with smaller communities and potentially lagging feature parity.

3. **Demo/prototype handoff.** React has the largest developer pool. Anyone picking this project up will know React. Vue and Svelte are viable for greenfield products but increase onboarding cost for a demo.

### Why Not Vue

Vue 3 + Pinia + Vite is a genuinely excellent stack. The main gap is `@azure/msal-browser` works fine but there is no official `msal-vue` package — you wire it manually or use a community package. For a project where auth is the foundation, this adds friction.

### Why Not Svelte / SvelteKit

Svelte's bundle size and reactivity model are elegant. The ecosystem for enterprise integrations (MSAL, Graph API clients) is noticeably thinner. SvelteKit adds SSR complexity that a pure SPA does not need.

**Confidence: HIGH** — MSAL official support for React is documented fact, not opinion.

---

## 2. Build Tooling: Vite

### Recommendation: Vite 6.x (or current stable)

**Use Vite.** This is not a close call for a SPA in 2025+.

### Why Vite

| Criterion | Vite | Create React App | Webpack (custom) | Parcel |
|-----------|------|------------------|------------------|--------|
| Dev server startup | Near-instant (ESM) | Slow (full bundle) | Slow | Fast |
| HMR speed | Sub-100ms | Seconds | Seconds | Fast |
| Config complexity | Low | None (but ejecting is painful) | High | Near-zero |
| Plugin ecosystem | Large (Rollup-compatible) | CRA-specific | Massive but dated | Small |
| Maintenance status | Actively developed | **Deprecated** | Active | Active |
| React support | `@vitejs/plugin-react` (official) | N/A | Manual | Yes |

### Create React App is Dead

CRA was officially deprecated by the React team. The React docs no longer recommend it. Do not use it.

### Vite Setup for This Project

```bash
npm create vite@latest ms-todo-sync -- --template react-ts
```

Key plugins needed:
- `@vitejs/plugin-react` — Fast Refresh via Babel/SWC
- `vite-plugin-svgr` — SVG as React components (optional but useful for icon assets)

**No special config needed for MSAL** — MSAL works as a standard browser dependency.

**Confidence: HIGH** — Vite's status as the de-facto standard for React SPAs is widely established.

---

## 3. UI Component Library

### Recommendation: shadcn/ui

**Use shadcn/ui.** For a daily-use productivity app that needs to look polished without a designer, this is the right choice in 2025.

### How shadcn/ui Works (Important Distinction)

shadcn/ui is **not an npm package you install.** It is a CLI that copies component source files into your project. You own the code. This is a fundamental design decision:

- `npx shadcn-ui@latest add button` → copies `src/components/ui/button.tsx` into your project
- You modify it directly, no overrides, no `!important` hacks
- Built on Radix UI primitives (accessibility) + Tailwind CSS (styling)

### Library Comparison for a To-do App

| Library | Model | Styling | Theming | Bundle | Accessibility | Fit |
|---------|-------|---------|---------|--------|---------------|-----|
| **shadcn/ui** | Copy-paste | Tailwind CSS | CSS variables, dark mode built-in | Zero (you own it) | Radix primitives (excellent) | **Best** |
| Radix UI (primitives only) | npm package | Unstyled | Manual | Small | Excellent | Good (if you want full control) |
| Mantine | npm package | CSS Modules + CSS vars | Theme provider | ~100KB | Good | Good but heavier |
| Chakra UI v3 | npm package | Panda CSS (v3) | Theme tokens | Medium | Good | OK, v3 migration was disruptive |

### Why shadcn/ui Wins for This Use Case

1. **Looks like a real product immediately.** The default theme (neutral palette, clean typography, subtle shadows) suits a productivity app without customization.
2. **Dark mode is first-class.** The `ThemeProvider` pattern with `next-themes` (or manual `class` toggle) is documented and works out of the box.
3. **Tailwind co-ownership.** Since you own the component code, adding task-specific styles (priority badges, status chips) means editing one file, not fighting a theme API.
4. **No bundle bloat.** You only include components you actually use.

### Why Not Mantine

Mantine is excellent and has a `DatePicker`, `Notifications`, and many other complete components that shadcn/ui lacks. For a larger app, Mantine wins on completeness. For a demo To-do app, shadcn/ui's visual quality and simplicity win. If you find yourself needing `DateTimePicker` or complex `DataTable`, add Mantine for those specific components while keeping shadcn/ui for the base.

### Why Not Chakra UI

Chakra UI v3 (Ark UI under the hood, Panda CSS) was a significant breaking change from v2. For a new prototype, v3 is the right version, but the migration turbulence and smaller community since the v3 shift make shadcn/ui the safer default.

**Required alongside shadcn/ui:**
- `tailwindcss` — peer dependency
- `tailwind-merge` + `clsx` — shadcn/ui uses these for conditional class merging
- `lucide-react` — the default icon set, consistent with shadcn/ui components

**Confidence: HIGH** — shadcn/ui's model and ecosystem were well-established through my knowledge cutoff.

---

## 4. Drag-and-Drop for Task Reordering

### Recommendation: `@dnd-kit/core` + `@dnd-kit/sortable`

**Use dnd-kit.** It is the current standard for React drag-and-drop.

### Library Comparison

| Library | Maintained | Accessibility | Touch Support | Bundle | React Version |
|---------|------------|---------------|---------------|--------|---------------|
| **dnd-kit** | Yes (active) | WAI-ARIA keyboard DnD | Yes | ~10KB | React 16+ |
| react-beautiful-dnd | **Abandoned** (Atlassian) | Good | Partial | ~30KB | React 16 only |
| react-dnd | Maintenance mode | Manual | Limited | ~20KB | React 16+ |
| Pragmatic DnD (Atlassian) | Yes (new) | Good | Good | ~8KB | React 18+ |

### Why dnd-kit

1. **react-beautiful-dnd is abandoned.** Atlassian deprecated it in favor of their new "Pragmatic drag-and-drop" library. Do not start a new project with it.
2. **dnd-kit has accessibility built in.** Keyboard navigation and screen reader announcements work without extra configuration — important for a daily-use productivity tool.
3. **Sortable preset makes task lists trivial.** `@dnd-kit/sortable` provides `useSortable`, `SortableContext`, and `arrayMove` which map directly to a reorderable task list.

### Minimal Implementation Pattern

```typescript
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';

// In your task list component:
<DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
    {tasks.map(task => <SortableTaskItem key={task.id} task={task} />)}
  </SortableContext>
</DndContext>
```

### Is Drag-and-Drop Actually Needed?

For an MS To-do sync demo specifically: probably not in v1. Microsoft To-do's own ordering uses `orderDateTime` on tasks, not positional drag-and-drop in the local UI. Consider building it as a v2 feature after the core Graph API sync is working. Mark as "deferred" until MVP is validated.

**Confidence: HIGH** — dnd-kit's position and react-beautiful-dnd's abandonment are established facts.

---

## 5. Data Fetching / Server State: TanStack Query

### Recommendation: TanStack Query v5 (`@tanstack/react-query`)

**Use TanStack Query.** For an app that reads from and writes to Microsoft Graph API, this is the correct tool. Do not manage Graph API state manually with `useState` + `useEffect`.

### Why TanStack Query for Graph API

The Graph API is a REST API with predictable response shapes. TanStack Query solves every problem you will hit:

| Problem | Without TanStack Query | With TanStack Query |
|---------|----------------------|---------------------|
| Loading/error/success states | Manual `useState` boilerplate | `isLoading`, `error`, `data` from `useQuery` |
| Caching responses | Manual, complex | Built-in, configurable `staleTime` |
| Re-fetching on window focus | Manual `visibilitychange` listeners | Automatic (configurable) |
| Parallel fetching (tasks + lists) | `Promise.all` + state management | Multiple `useQuery` hooks, automatic deduplication |
| Optimistic updates for task completion | Complex manual rollback logic | `useMutation` + `onMutate`/`onError` |
| Background sync / polling | `setInterval` + cleanup | `refetchInterval` option |

### Key Patterns for Graph API

**Pattern 1: Query key design**

```typescript
// Use structured query keys that encode the resource + params
const { data: taskLists } = useQuery({
  queryKey: ['graph', 'taskLists'],
  queryFn: () => graphClient.api('/me/todo/lists').get(),
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const { data: tasks } = useQuery({
  queryKey: ['graph', 'tasks', listId],
  queryFn: () => graphClient.api(`/me/todo/lists/${listId}/tasks`).get(),
  enabled: !!listId,
});
```

**Pattern 2: Optimistic mutation for task completion**

```typescript
const completeTask = useMutation({
  mutationFn: ({ listId, taskId }: CompleteTaskArgs) =>
    graphClient.api(`/me/todo/lists/${listId}/tasks/${taskId}`)
      .patch({ status: 'completed' }),
  onMutate: async ({ listId, taskId }) => {
    await queryClient.cancelQueries({ queryKey: ['graph', 'tasks', listId] });
    const previous = queryClient.getQueryData(['graph', 'tasks', listId]);
    queryClient.setQueryData(['graph', 'tasks', listId], (old) =>
      old?.value.map(t => t.id === taskId ? { ...t, status: 'completed' } : t)
    );
    return { previous };
  },
  onError: (_, { listId }, context) => {
    queryClient.setQueryData(['graph', 'tasks', listId], context?.previous);
  },
  onSettled: (_, __, { listId }) => {
    queryClient.invalidateQueries({ queryKey: ['graph', 'tasks', listId] });
  },
});
```

**Pattern 3: Pairing with MSAL token acquisition**

```typescript
// Custom queryFn factory that always attaches a fresh token
async function graphFetch<T>(path: string, msalInstance: IPublicClientApplication): Promise<T> {
  const account = msalInstance.getAllAccounts()[0];
  const { accessToken } = await msalInstance.acquireTokenSilent({
    scopes: ['Tasks.ReadWrite'],
    account,
  });
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.json();
}
```

**Confidence: HIGH** — TanStack Query v5 API was finalized and documented through my cutoff.

---

## 6. Local UI State: Zustand

### Recommendation: Zustand v4.x

**Use Zustand for UI state.** Keep Graph API state in TanStack Query. Keep local UI state (selected list, sidebar open, filter/sort, modal state) in Zustand.

### State Separation Model

```
TanStack Query          Zustand
─────────────────       ──────────────────────
taskLists (Graph)  ←→   selectedListId
tasks (Graph)           sidebarOpen
user profile            activeFilter ('all' | 'today' | 'important')
                        editingTaskId
                        theme ('light' | 'dark')
```

**Rule:** If it came from the server → TanStack Query. If it is purely UI behavior with no server-side equivalent → Zustand.

### Why Zustand Over Redux Toolkit / Jotai / Context

| Library | Boilerplate | Bundle | DevTools | Learning Curve |
|---------|-------------|--------|----------|----------------|
| **Zustand** | Minimal | ~2KB | Yes (Redux DevTools) | Low |
| Redux Toolkit | Medium | ~13KB | Excellent | Medium |
| Jotai | Minimal | ~3KB | Limited | Low |
| React Context | None | 0KB | None | None |

For a demo app: React Context is tempting but leads to re-render problems once state is non-trivial. Zustand is the right size — powerful enough to not hit walls, small enough to not feel like infrastructure.

### Zustand Store Pattern for This App

```typescript
// stores/ui.store.ts
import { create } from 'zustand';

interface UIState {
  selectedListId: string | null;
  activeFilter: 'all' | 'today' | 'important' | 'completed';
  sidebarOpen: boolean;
  selectList: (id: string) => void;
  setFilter: (filter: UIState['activeFilter']) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedListId: null,
  activeFilter: 'all',
  sidebarOpen: true,
  selectList: (id) => set({ selectedListId: id }),
  setFilter: (filter) => set({ activeFilter: filter }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
```

**Confidence: HIGH** — Zustand's API was stable and its usage pattern is well-established.

---

## 7. TypeScript

### Recommendation: TypeScript — Strongly Recommended, Not Optional

**Use TypeScript from day one.** The `--template react-ts` Vite scaffold costs nothing and prevents a painful migration later.

### Why It Matters More Than Usual Here

1. **Microsoft Graph API has official TypeScript types.** The `@microsoft/microsoft-graph-types` package provides full type definitions for every Graph resource. Without TypeScript, you lose this entirely.

   ```typescript
   import type { TodoTask, TodoTaskList } from '@microsoft/microsoft-graph-types';

   const tasks: TodoTask[] = response.value; // fully typed
   tasks[0].dueDateTime?.dateTime; // editor knows this field exists
   ```

2. **MSAL types.** `@azure/msal-browser` and `@azure/msal-react` ship comprehensive TypeScript types. Using them without TypeScript is wasteful.

3. **TanStack Query generics.** `useQuery<TodoTask[]>` gives you typed `data` throughout the component tree without casting.

4. **Prototype to production path.** If this demo becomes a real product, TypeScript is the first thing you would add. Do it now.

### Packages to Install

```bash
npm install -D typescript @types/react @types/react-dom
npm install @microsoft/microsoft-graph-types
```

**Confidence: HIGH**

---

## 8. Folder Structure: Feature-Based Pattern

### Recommendation: Feature-Collocated Structure

Avoid the common mistake of organizing by file type (`/components`, `/hooks`, `/utils` at the root). For a to-do app with distinct feature areas (auth, task lists, tasks, sync status), organize by feature.

### Recommended Structure

```
src/
├── app/                          # App-level setup (not features)
│   ├── App.tsx                   # Root component, providers
│   ├── router.tsx                # React Router or similar
│   └── queryClient.ts            # TanStack Query client instance
│
├── features/
│   ├── auth/                     # MSAL authentication
│   │   ├── components/
│   │   │   ├── LoginButton.tsx
│   │   │   └── AuthGuard.tsx
│   │   ├── hooks/
│   │   │   └── useGraphToken.ts
│   │   └── index.ts              # Public API of this feature
│   │
│   ├── task-lists/               # Left sidebar: list of To-do lists
│   │   ├── components/
│   │   │   ├── TaskListSidebar.tsx
│   │   │   └── TaskListItem.tsx
│   │   ├── hooks/
│   │   │   └── useTaskLists.ts   # wraps useQuery for /me/todo/lists
│   │   ├── api/
│   │   │   └── taskLists.api.ts  # raw Graph API calls
│   │   └── index.ts
│   │
│   ├── tasks/                    # Main content: tasks in a list
│   │   ├── components/
│   │   │   ├── TaskList.tsx
│   │   │   ├── TaskItem.tsx
│   │   │   ├── TaskDetail.tsx
│   │   │   └── AddTaskForm.tsx
│   │   ├── hooks/
│   │   │   ├── useTasks.ts       # useQuery for /me/todo/lists/:id/tasks
│   │   │   └── useCompleteTask.ts # useMutation
│   │   ├── api/
│   │   │   └── tasks.api.ts
│   │   └── index.ts
│   │
│   └── sync/                     # Sync status, last-synced indicator
│       ├── components/
│       │   └── SyncStatusBadge.tsx
│       └── hooks/
│           └── useSyncStatus.ts
│
├── shared/                       # Truly shared across features
│   ├── components/
│   │   └── ui/                   # shadcn/ui copied components live here
│   │       ├── button.tsx
│   │       ├── checkbox.tsx
│   │       └── ...
│   ├── hooks/
│   │   └── useDebounce.ts
│   └── lib/
│       └── utils.ts              # cn() utility for Tailwind merging
│
├── stores/
│   └── ui.store.ts               # Zustand store
│
└── main.tsx                      # Entry point, MsalProvider wrapping
```

### Key Structural Rules

1. **`features/` are silos.** A feature should not import from another feature's internals. Use the `index.ts` barrel as the public API.
2. **`shared/` is for truly shared code.** If something is only used in one feature, it stays in that feature. Move it to `shared/` only when a second feature needs it.
3. **`api/` functions are not components.** Keep raw Graph API calls in `*.api.ts` files, separate from hooks. Hooks compose query logic; `api/` files are pure fetch functions. This makes testing trivial.
4. **`stores/` stays flat.** For a demo app, one Zustand file is sufficient. Split when/if you have more than ~5 distinct domains of UI state.

**Confidence: MEDIUM** — Feature-based folder structure is a community pattern, not a framework-prescribed standard. This represents strong community consensus as of my cutoff.

---

## Full Recommended Stack Summary

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Framework | React | 18.x | `react` + `react-dom` |
| Language | TypeScript | 5.x | Use strict mode |
| Build tool | Vite | 6.x | `@vitejs/plugin-react` |
| Auth | MSAL React | `@azure/msal-react` 2.x | Official Microsoft package |
| Graph types | MS Graph Types | `@microsoft/microsoft-graph-types` | Types only, no runtime cost |
| UI components | shadcn/ui | CLI-based | Built on Radix + Tailwind |
| CSS | Tailwind CSS | 3.x | Required by shadcn/ui |
| Icons | Lucide React | latest | Default icon set for shadcn/ui |
| Server state | TanStack Query | v5 | `@tanstack/react-query` |
| UI state | Zustand | v4 | `zustand` |
| Drag-and-drop | dnd-kit | v6 | `@dnd-kit/core` + `@dnd-kit/sortable` (defer to v2) |
| Routing | React Router | v6 | `react-router-dom` (if multi-view needed) |

### Install Commands

```bash
# Scaffold
npm create vite@latest ms-todo-sync -- --template react-ts
cd ms-todo-sync

# Core runtime
npm install react react-dom

# Auth + Graph
npm install @azure/msal-browser @azure/msal-react
npm install -D @microsoft/microsoft-graph-types

# State + data fetching
npm install @tanstack/react-query zustand

# UI
npm install tailwindcss postcss autoprefixer
npx tailwindcss init -p
npx shadcn-ui@latest init

# Common shadcn/ui components for a To-do app
npx shadcn-ui@latest add button checkbox input label badge
npx shadcn-ui@latest add dialog sheet separator scroll-area

# Icons
npm install lucide-react

# DnD (defer until needed)
# npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## Alternatives Considered and Rejected

| Category | Recommended | Rejected | Reason for Rejection |
|----------|-------------|----------|----------------------|
| Framework | React | Vue 3 | No official `msal-vue`; ports for shadcn/ui and TanStack Query are secondary targets |
| Framework | React | Svelte | Thin enterprise ecosystem; no official MSAL support |
| Build tool | Vite | Create React App | Officially deprecated by React team |
| Build tool | Vite | Webpack (custom) | No justification for complexity on a SPA demo |
| UI library | shadcn/ui | Chakra UI v3 | v3 was a significant breaking change, smaller community post-migration |
| UI library | shadcn/ui | Mantine | Heavier bundle; justified for complex apps but overkill for demo |
| DnD | dnd-kit | react-beautiful-dnd | Officially abandoned by Atlassian |
| State | Zustand | Redux Toolkit | Over-engineered for a demo; boilerplate cost not justified |
| State | Zustand | React Context alone | Causes re-render problems at non-trivial state complexity |

---

## Pitfalls Specific to This Stack

### MSAL + React StrictMode Double-Mount

React 18 StrictMode mounts components twice in development. MSAL's interaction-in-progress handling can throw errors on the second mount. Fix: wrap MSAL initialization in `MsalProvider` at the very root, above `StrictMode`, or use the official MSAL React guidance for handling `InteractionRequiredAuthError`.

### TanStack Query + MSAL Token Expiry

Access tokens expire (default 1 hour for Graph). Do not store the token in a variable outside the `queryFn`. Always call `acquireTokenSilent` inside the `queryFn` — MSAL handles caching and refresh internally. If you cache the token in a module-level variable, you will get 401s after expiry.

### shadcn/ui + Tailwind CSS v4

As of my knowledge cutoff (Aug 2025), shadcn/ui was updating to support Tailwind CSS v4. Verify current compatibility before choosing Tailwind v3 vs v4. If the CLI asks, check the official shadcn/ui docs for the recommended Tailwind version — they are updated frequently.

### Graph API Pagination

Microsoft Graph API paginates responses at 100 items by default. `useQuery` fetching `/me/todo/lists/:id/tasks` will only return the first page. Implement `$top` parameter handling and `@odata.nextLink` pagination before the demo if your test account has more than 100 tasks.

### `orderDateTime` Not `position`

Microsoft To-do does not use integer positions for task ordering. It uses `orderDateTime` — a string timestamp. Drag-and-drop reordering requires computing a new `orderDateTime` between adjacent tasks, not just swapping indices. This makes implementing DnD non-trivial; factor this into the "defer to v2" decision.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| React over Vue/Svelte for MSAL | HIGH | MSAL official packages are documented fact |
| Vite as build tool | HIGH | CRA deprecation is documented; Vite ecosystem is established |
| shadcn/ui recommendation | HIGH | Model and community position well-documented through cutoff |
| TanStack Query v5 API | HIGH | v5 was stable and released through cutoff |
| Zustand v4 API | HIGH | Stable API, widely used |
| dnd-kit over RBD | HIGH | RBD abandonment is documented |
| Folder structure pattern | MEDIUM | Community consensus, not framework-enforced |
| shadcn/ui + Tailwind v4 compatibility | LOW | This was in flux near my cutoff — verify before scaffolding |
| Graph API `orderDateTime` behavior | MEDIUM | Based on Graph API docs known through cutoff; verify in Graph Explorer |

---

## Open Questions / Verify Before Building

1. **shadcn/ui + Tailwind CSS v4:** Confirm the current recommended Tailwind version in shadcn/ui docs. As of Aug 2025 this was in active transition. Check `https://ui.shadcn.com/docs/installation/vite` for current install steps.

2. **MSAL React version:** Confirm `@azure/msal-react` 2.x is still current and no v3 breaking changes have shipped.

3. **TanStack Query v5 vs v5.x:** Verify no major API changes have shipped in 2025/2026 for React Query's `useMutation` shape — particularly `onMutate` return type handling.

4. **Graph API task ordering:** Test `orderDateTime` behavior in your tenant before committing to drag-and-drop ordering as a feature. The behavior can vary by task creation source.
