import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TodoTask } from "@microsoft/microsoft-graph-types";
import { useGraphToken } from "../../auth";
import { createTask } from "../api/tasks.api";
import { toast } from "sonner";

export function useCreateTask(listId: string) {
  const { getToken } = useGraphToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (title: string) => {
      return createTask(getToken, listId, title);
    },
    onMutate: async (title: string) => {
      // Cancel in-flight queries so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["tasks", listId] });

      // Snapshot current cache for rollback
      const snapshot = queryClient.getQueryData<TodoTask[]>(["tasks", listId]);

      // Create optimistic task with tmp-{uuid} ID
      const optimisticTask: TodoTask = {
        id: `tmp-${crypto.randomUUID()}`,
        title,
        status: "notStarted",
        importance: "normal",
        createdDateTime: new Date().toISOString(),
        lastModifiedDateTime: new Date().toISOString(),
      };

      // Insert at the beginning of the list
      queryClient.setQueryData<TodoTask[]>(
        ["tasks", listId],
        (old) => [optimisticTask, ...(old ?? [])]
      );

      return { snapshot, optimisticTask };
    },
    onSuccess: (serverTask, _title, context) => {
      // Replace the tmp-{uuid} entry with the real server task
      queryClient.setQueryData<TodoTask[]>(
        ["tasks", listId],
        (old) =>
          (old ?? []).map((t) =>
            t.id === context?.optimisticTask.id ? serverTask : t
          )
      );
    },
    onError: (_error, _title, context) => {
      // Rollback to snapshot
      if (context?.snapshot) {
        queryClient.setQueryData(["tasks", listId], context.snapshot);
      }
      toast.error("Failed to create task");
    },
    onSettled: () => {
      // Refetch to ensure cache is in sync with server
      queryClient.invalidateQueries({ queryKey: ["tasks", listId] });
    },
  });
}
