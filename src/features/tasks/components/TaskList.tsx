import { useTasks } from "../hooks/useTasks";
import { useDeleteTask } from "../hooks/useDeleteTask";
import { TaskItem } from "./TaskItem";
import { AddTaskForm } from "./AddTaskForm";
import { useSyncStore } from "../../../stores/sync.store";

interface TaskListProps {
  listId: string;
}

export function TaskList({ listId }: TaskListProps) {
  const { data: tasks, isLoading, error } = useTasks(listId);
  const deleteMutation = useDeleteTask(listId);
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

  return (
    <div className="flex flex-col h-full">
      {/* Add task form at the top */}
      <div className="border-b">
        <AddTaskForm listId={listId} />
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto">
        {!tasks || tasks.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-muted-foreground">No tasks in this list</p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                isFromFlaggedEmails={isFromFlaggedEmails}
                onDelete={(taskId) => deleteMutation.mutate(taskId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
