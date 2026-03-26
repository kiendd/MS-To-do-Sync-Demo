import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SyncStore {
  // Delta links
  listsDeltaLink: string | null;
  tasksDeltaLinks: Record<string, string | null>; // keyed by list ID

  // Sync metadata
  lastSyncedAt: number | null;
  syncStatus: "idle" | "syncing" | "error" | "resyncing";

  // UI selection
  selectedListId: string | null;

  // Flagged emails list
  flaggedEmailsListId: string | null;

  // Actions
  setListsDeltaLink: (link: string | null) => void;
  setTasksDeltaLink: (listId: string, link: string | null) => void;
  setLastSyncedAt: (ts: number) => void;
  setSyncStatus: (s: SyncStore["syncStatus"]) => void;
  setSelectedListId: (id: string | null) => void;
  setFlaggedEmailsListId: (id: string | null) => void;
  clearTasksDeltaLink: (listId: string) => void;
  resetAllDeltaLinks: () => void;
}

export const useSyncStore = create<SyncStore>()(
  persist(
    (set) => ({
      listsDeltaLink: null,
      tasksDeltaLinks: {},
      lastSyncedAt: null,
      syncStatus: "idle",
      selectedListId: null,
      flaggedEmailsListId: null,

      setListsDeltaLink: (link) => set({ listsDeltaLink: link }),
      setTasksDeltaLink: (listId, link) =>
        set((state) => ({
          tasksDeltaLinks: { ...state.tasksDeltaLinks, [listId]: link },
        })),
      setLastSyncedAt: (ts) => set({ lastSyncedAt: ts }),
      setSyncStatus: (s) => set({ syncStatus: s }),
      setSelectedListId: (id) => set({ selectedListId: id }),
      setFlaggedEmailsListId: (id) => set({ flaggedEmailsListId: id }),
      clearTasksDeltaLink: (listId) =>
        set((state) => ({
          tasksDeltaLinks: { ...state.tasksDeltaLinks, [listId]: null },
        })),
      resetAllDeltaLinks: () =>
        set({
          listsDeltaLink: null,
          tasksDeltaLinks: {},
        }),
    }),
    {
      name: "ms-todo-sync-store",
      partialize: (state) => ({
        listsDeltaLink: state.listsDeltaLink,
        tasksDeltaLinks: state.tasksDeltaLinks,
        lastSyncedAt: state.lastSyncedAt,
        selectedListId: state.selectedListId,
        flaggedEmailsListId: state.flaggedEmailsListId,
      }),
    }
  )
);
