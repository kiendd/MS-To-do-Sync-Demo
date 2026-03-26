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

/**
 * Create a new task in a list.
 * POST /me/todo/lists/{listId}/tasks
 * Body: { title, status: "notStarted" }
 * Returns the full server-created TodoTask (with real id).
 */
export async function createTask(
  getToken: () => Promise<string>,
  listId: string,
  title: string
): Promise<TodoTask> {
  return graphFetch<TodoTask>(
    `/me/todo/lists/${listId}/tasks`,
    getToken,
    {
      method: "POST",
      body: { title, status: "notStarted" },
    }
  );
}

/**
 * Delete a task from a list.
 * DELETE /me/todo/lists/{listId}/tasks/{taskId}
 * Returns void (204 No Content).
 */
export async function deleteTask(
  getToken: () => Promise<string>,
  listId: string,
  taskId: string
): Promise<void> {
  await graphFetch<void>(
    `/me/todo/lists/${listId}/tasks/${taskId}`,
    getToken,
    { method: "DELETE" }
  );
}

/**
 * Update a task via PATCH.
 * PATCH /me/todo/lists/{listId}/tasks/{taskId}
 * Body: partial TodoTask fields (only changed fields).
 * Returns the full updated TodoTask from the server.
 *
 * IMPORTANT: Date fields (dueDateTime, completedDateTime, etc.) MUST use
 * the dateTimeTimeZone object format { dateTime, timeZone }, NOT plain ISO strings.
 * Use toGraphDateTime() from src/lib/graph-utils.ts for any date values.
 */
export async function updateTask(
  getToken: () => Promise<string>,
  listId: string,
  taskId: string,
  patch: Partial<TodoTask>
): Promise<TodoTask> {
  return graphFetch<TodoTask>(
    `/me/todo/lists/${listId}/tasks/${taskId}`,
    getToken,
    {
      method: "PATCH",
      body: patch,
    }
  );
}
