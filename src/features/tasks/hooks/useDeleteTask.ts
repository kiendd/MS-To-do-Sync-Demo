import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TodoTask } from "@microsoft/microsoft-graph-types";
import { useGraphToken } from "../../auth";
import { deleteTask } from "../api/tasks.api";
import { toast } from "sonner";

export function useDeleteTask(listId: string) {
  const { getToken } = useGraphToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      return deleteTask(getToken, listId, taskId);
    },
    onMutate: async (taskId: string) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", listId] });

      const snapshot = queryClient.getQueryData<TodoTask[]>(["tasks", listId]);

      // Optimistically remove the task from the cache
      queryClient.setQueryData<TodoTask[]>(
        ["tasks", listId],
        (old) => (old ?? []).filter((t) => t.id !== taskId)
      );

      return { snapshot };
    },
    onError: (_error, _taskId, context) => {
      // Rollback: restore the task
      if (context?.snapshot) {
        queryClient.setQueryData(["tasks", listId], context.snapshot);
      }
      toast.error("Failed to delete task");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", listId] });
    },
  });
}
