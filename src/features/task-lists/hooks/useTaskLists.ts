import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TodoTaskList } from "@microsoft/microsoft-graph-types";
import { useGraphToken } from "../../auth";
import { useSyncStore } from "../../../stores/sync.store";
import { fetchTaskListsDelta } from "../api/taskLists.api";

export function useTaskLists() {
  const { getToken } = useGraphToken();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["taskLists"],
    queryFn: async (): Promise<TodoTaskList[]> => {
      const store = useSyncStore.getState();
      store.setSyncStatus("syncing");

      try {
        // If we have a stored deltaLink but the TanStack Query cache is empty
        // (e.g. page reload), the in-memory cache is gone — fall back to full sync
        // so we don't merge an incremental delta into an empty list.
        const existingLists =
          queryClient.getQueryData<TodoTaskList[]>(["taskLists"]) ?? [];
        const effectiveDeltaLink =
          store.listsDeltaLink && existingLists.length === 0
            ? null
            : store.listsDeltaLink;

        const { lists, deltaLink } = await fetchTaskListsDelta(
          getToken,
          effectiveDeltaLink
        );

        // On initial sync (no prior deltaLink), replace the full cache.
        // On incremental sync (had a deltaLink), merge changes into existing cache.
        let mergedLists: TodoTaskList[];

        if (effectiveDeltaLink === null) {
          // Initial sync — use full result
          mergedLists = lists;
        } else {
          // Incremental sync — merge delta into existing
          const listMap = new Map(
            existingLists.map((l) => [l.id, l])
          );
          for (const list of lists) {
            if ((list as any)["@removed"]) {
              listMap.delete(list.id);
            } else {
              const existing = listMap.get(list.id);
              listMap.set(list.id, existing ? { ...existing, ...list } : list);
            }
          }
          mergedLists = Array.from(listMap.values());
        }

        // Save the new deltaLink (per SYNC-01: store full URL, never parse)
        if (deltaLink) {
          store.setListsDeltaLink(deltaLink);
        }

        // Detect flaggedEmails list (per LIST-02)
        const flaggedList = mergedLists.find(
          (l) => l.wellknownListName === "flaggedEmails"
        );
        if (flaggedList?.id) {
          store.setFlaggedEmailsListId(flaggedList.id);
        }

        // Auto-select first list if none selected
        if (!store.selectedListId && mergedLists.length > 0) {
          store.setSelectedListId(mergedLists[0].id ?? null);
        }

        store.setSyncStatus("idle");
        store.setLastSyncedAt(Date.now());
        return mergedLists;
      } catch (error: any) {
        // Handle 410 Gone (per SYNC-03) and 404 Item Not Found (stale delta link
        // from a different account/session) — clear deltaLink, restart full sync
        if (
          error?.message?.includes("410") ||
          error?.code === "GoneError" ||
          error?.message?.includes("404") ||
          error?.message === "Item not found"
        ) {
          store.setListsDeltaLink(null);
          store.setSyncStatus("resyncing");
          // Retry with no deltaLink (full sync)
          const { lists, deltaLink: newDeltaLink } =
            await fetchTaskListsDelta(getToken, null);

          if (newDeltaLink) {
            store.setListsDeltaLink(newDeltaLink);
          }

          const flaggedList = lists.find(
            (l) => l.wellknownListName === "flaggedEmails"
          );
          if (flaggedList?.id) {
            store.setFlaggedEmailsListId(flaggedList.id);
          }

          if (!store.selectedListId && lists.length > 0) {
            store.setSelectedListId(lists[0].id ?? null);
          }

          store.setSyncStatus("idle");
          store.setLastSyncedAt(Date.now());
          return lists;
        }

        store.setSyncStatus("error");
        throw error;
      }
    },
    // Initial fetch enabled only when we have a token provider
    enabled: !!getToken,
  });
}
