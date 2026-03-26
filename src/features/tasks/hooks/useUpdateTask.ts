import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TodoTask } from "@microsoft/microsoft-graph-types";
import { useGraphToken } from "../../auth";
import { updateTask } from "../api/tasks.api";
import { useSyncStore } from "../../../stores/sync.store";
import { toast } from "sonner";

interface UpdateTaskInput {
  taskId: string;
  patch: Partial<TodoTask>;
}

export function useUpdateTask(listId: string) {
  const { getToken } = useGraphToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, patch }: UpdateTaskInput) => {
      return updateTask(getToken, listId, taskId, patch);
    },
    onMutate: async ({ taskId, patch }: UpdateTaskInput) => {
      // Register this task as having a pending mutation (conflict guard per SYNC-04)
      useSyncStore.getState().addPendingMutation(taskId);

      // Cancel in-flight queries to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["tasks", listId] });

      // Snapshot for rollback
      const snapshot = queryClient.getQueryData<TodoTask[]>(["tasks", listId]);

      // Optimistically merge the patch into the cached task
      queryClient.setQueryData<TodoTask[]>(
        ["tasks", listId],
        (old) =>
          (old ?? []).map((t) =>
            t.id === taskId ? { ...t, ...patch } : t
          )
      );

      return { snapshot, taskId };
    },
    onSuccess: (serverTask, { taskId }) => {
      // Replace the optimistic version with the full server response
      queryClient.setQueryData<TodoTask[]>(
        ["tasks", listId],
        (old) =>
          (old ?? []).map((t) =>
            t.id === taskId ? serverTask : t
          )
      );
    },
    onError: (_error, _input, context) => {
      // Rollback to snapshot
      if (context?.snapshot) {
        queryClient.setQueryData(["tasks", listId], context.snapshot);
      }
      toast.error("Failed to update task");
    },
    onSettled: (_data, _error, _input, context) => {
      // Remove from pending mutations (conflict guard)
      if (context?.taskId) {
        useSyncStore.getState().removePendingMutation(context.taskId);
      }
      // Refetch to ensure cache matches server
      queryClient.invalidateQueries({ queryKey: ["tasks", listId] });
    },
  });
}
