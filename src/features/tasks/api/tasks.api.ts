import { graphFetch } from "../../graph";
import type { GraphPagedResponse } from "../../graph";
import type { TodoTask } from "@microsoft/microsoft-graph-types";

/**
 * Fetch tasks for a list via delta query. Paginates through ALL @odata.nextLink
 * pages before returning. Returns accumulated tasks AND the final deltaLink.
 *
 * CRITICAL: Never save the deltaLink until ALL nextLink pages are consumed.
 * CRITICAL: Delta responses return PARTIAL objects for updates — only id + changed fields.
 * CRITICAL: @removed items have { id, "@removed": { reason: "deleted" } } — must delete from cache.
 */
export async function fetchTasksDelta(
  getToken: () => Promise<string>,
  listId: string,
  deltaLink: string | null
): Promise<{ tasks: TodoTask[]; deltaLink: string | null; removedIds: string[] }> {
  const url = deltaLink ?? `/me/todo/lists/${listId}/tasks/delta`;
  const allTasks: TodoTask[] = [];
  const removedIds: string[] = [];
  let nextUrl: string | null = url;
  let finalDeltaLink: string | null = null;

  while (nextUrl) {
    const response: GraphPagedResponse<TodoTask> = await graphFetch<GraphPagedResponse<TodoTask>>(
      nextUrl,
      getToken
    );

    for (const task of response.value) {
      if ((task as any)["@removed"]) {
        if (task.id) removedIds.push(task.id);
      } else {
        allTasks.push(task);
      }
    }

    if (response["@odata.nextLink"]) {
      nextUrl = response["@odata.nextLink"];
    } else {
      finalDeltaLink = response["@odata.deltaLink"] ?? null;
      nextUrl = null;
    }
  }

  return { tasks: allTasks, deltaLink: finalDeltaLink, removedIds };
}
