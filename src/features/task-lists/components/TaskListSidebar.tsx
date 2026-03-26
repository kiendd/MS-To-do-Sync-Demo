import { useSyncStore } from "../../../stores/sync.store";
import { useTaskLists } from "../hooks/useTaskLists";
import { TaskListItem } from "./TaskListItem";

export function TaskListSidebar() {
  const { data: taskLists, isLoading, error } = useTaskLists();
  const selectedListId = useSyncStore((s) => s.selectedListId);
  const setSelectedListId = useSyncStore((s) => s.setSelectedListId);

  if (isLoading) {
    return (
      <aside className="w-64 border-r p-4">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Lists</h2>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="w-64 border-r p-4">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Lists</h2>
        <p className="text-sm text-destructive">Failed to load lists</p>
        <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
      </aside>
    );
  }

  return (
    <aside className="w-64 border-r p-4">
      <h2 className="text-sm font-semibold text-muted-foreground mb-3">Lists</h2>
      <nav className="space-y-1">
        {taskLists?.map((list) => (
          <TaskListItem
            key={list.id}
            list={list}
            isSelected={selectedListId === list.id}
            onSelect={setSelectedListId}
          />
        ))}
      </nav>
    </aside>
  );
}
