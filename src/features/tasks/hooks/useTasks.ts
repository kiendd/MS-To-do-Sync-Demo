import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TodoTask } from "@microsoft/microsoft-graph-types";
import { useGraphToken } from "../../auth";
import { useSyncStore } from "../../../stores/sync.store";
import { fetchTasksDelta } from "../api/tasks.api";

export function useTasks(listId: string | null) {
  const { getToken } = useGraphToken();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["tasks", listId],
    queryFn: async (): Promise<TodoTask[]> => {
      if (!listId) return [];

      const store = useSyncStore.getState();

      store.setSyncStatus("syncing");

      try {
        // Get existing cache for merge
        const existingTasks =
          queryClient.getQueryData<TodoTask[]>(["tasks", listId]) ?? [];

        // If we have a stored deltaLink but TanStack Query cache is empty (e.g. page
        // reload), fall back to full sync so we don't merge incremental into nothing.
        const storedDeltaLink = store.tasksDeltaLinks[listId] ?? null;
        const existingDeltaLink =
          storedDeltaLink && existingTasks.length === 0 ? null : storedDeltaLink;

        const { tasks, deltaLink, removedIds } = await fetchTasksDelta(
          getToken,
          listId,
          existingDeltaLink
        );

        let mergedTasks: TodoTask[];

        if (existingDeltaLink === null) {
          // Initial sync — full replacement
          mergedTasks = tasks;
        } else {
          // Incremental sync — merge delta changes into existing cache
          // CRITICAL: Delta returns PARTIAL objects for updates.
          // Must shallow-merge into existing, not replace.
          const taskMap = new Map(
            existingTasks.map((t) => [t.id, t])
          );

          // Read conflict guard set once (SYNC-04)
          const pendingMutations = useSyncStore.getState().pendingMutations;

          // Remove deleted tasks
          for (const id of removedIds) {
            // Don't remove a task that has a pending mutation (e.g., user is editing a task
            // that was deleted on another client -- the mutation will fail and handle it)
            if (!pendingMutations.has(id)) {
              taskMap.delete(id);
            }
          }

          // Add new / merge updated tasks
          for (const task of tasks) {
            // CONFLICT GUARD (SYNC-04): skip server update for tasks with pending local mutations.
            // The locally optimistic state is authoritative until onSettled removes from pendingMutations.
            if (task.id && pendingMutations.has(task.id)) {
              continue;
            }
            const existing = taskMap.get(task.id);
            if (existing) {
              // Shallow merge — keep existing fields, overwrite changed fields
              taskMap.set(task.id, { ...existing, ...task });
            } else {
              taskMap.set(task.id, task);
            }
          }

          mergedTasks = Array.from(taskMap.values());
        }

        // Save the deltaLink for this list (per SYNC-01: store full opaque URL)
        if (deltaLink) {
          store.setTasksDeltaLink(listId, deltaLink);
        }

        store.setSyncStatus("idle");
        store.setLastSyncedAt(Date.now());
        return mergedTasks;
      } catch (error: any) {
        // Handle 410 Gone (per SYNC-03) and 404 Item Not Found (stale delta link
        // from a different account/session) — clear deltaLink, restart full sync
        if (
          error?.message?.includes("410") ||
          error?.code === "GoneError" ||
          error?.message?.includes("404") ||
          error?.message === "Item not found"
        ) {
          store.clearTasksDeltaLink(listId);
          store.setSyncStatus("resyncing");

          // Retry with no deltaLink (full re-sync)
          const { tasks, deltaLink: newDeltaLink } =
            await fetchTasksDelta(getToken, listId, null);

          if (newDeltaLink) {
            store.setTasksDeltaLink(listId, newDeltaLink);
          }

          store.setSyncStatus("idle");
          store.setLastSyncedAt(Date.now());
          return tasks;
        }

        store.setSyncStatus("error");
        throw error;
      }
    },
    enabled: !!listId && !!getToken,
    refetchInterval: 30_000,                   // Per SYNC-01: poll every 30 seconds
    refetchIntervalInBackground: false,         // Per SYNC-01: pause when tab hidden
  });
}
