import { useTasks } from "../hooks/useTasks";
import { TaskItem } from "./TaskItem";
import { useSyncStore } from "../../../stores/sync.store";

interface TaskListProps {
  listId: string;
}

export function TaskList({ listId }: TaskListProps) {
  const { data: tasks, isLoading, error } = useTasks(listId);
  const flaggedEmailsListId = useSyncStore((s) => s.flaggedEmailsListId);
  const isFromFlaggedEmails = listId === flaggedEmailsListId;

  if (isLoading && !tasks) {
    return (
      <div className="space-y-2 p-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-destructive">Failed to load tasks</p>
        <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-muted-foreground">No tasks in this list</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          isFromFlaggedEmails={isFromFlaggedEmails}
        />
      ))}
    </div>
  );
}
