import { useUpdateTask } from "./useUpdateTask";
import type { TodoTask } from "@microsoft/microsoft-graph-types";

/**
 * Toggle task between "completed" and "notStarted".
 * Wraps useUpdateTask with the correct status field.
 *
 * Graph task status values: "notStarted" | "inProgress" | "completed" | "waitingOnOthers" | "deferred"
 * We only toggle between "completed" and "notStarted" per TASK-05.
 */
export function useCompleteTask(listId: string) {
  const updateMutation = useUpdateTask(listId);

  const toggleComplete = (task: TodoTask) => {
    if (!task.id) return;
    const newStatus = task.status === "completed" ? "notStarted" : "completed";
    updateMutation.mutate({
      taskId: task.id,
      patch: { status: newStatus },
    });
  };

  return {
    toggleComplete,
    isPending: updateMutation.isPending,
  };
}
