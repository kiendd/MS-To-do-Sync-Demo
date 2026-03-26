import { graphFetch } from "../../graph";
import type { GraphPagedResponse } from "../../graph";
import type { TodoTaskList } from "@microsoft/microsoft-graph-types";

/**
 * Fetches all task lists via delta query. Paginates through ALL @odata.nextLink
 * pages before returning. Returns the accumulated lists AND the final deltaLink.
 *
 * CRITICAL: Never save a deltaLink until ALL nextLink pages are consumed.
 * The deltaLink only appears on the LAST page.
 */
export async function fetchTaskListsDelta(
  getToken: () => Promise<string>,
  deltaLink: string | null
): Promise<{ lists: TodoTaskList[]; deltaLink: string | null }> {
  const url = deltaLink ?? "/me/todo/lists/delta";
  const allLists: TodoTaskList[] = [];
  let nextUrl: string | null = url;
  let finalDeltaLink: string | null = null;

  while (nextUrl) {
    const page: GraphPagedResponse<TodoTaskList> = await graphFetch<GraphPagedResponse<TodoTaskList>>(
      nextUrl,
      getToken
    );
    allLists.push(...page.value);

    if (page["@odata.nextLink"]) {
      nextUrl = page["@odata.nextLink"];
    } else {
      finalDeltaLink = page["@odata.deltaLink"] ?? null;
      nextUrl = null;
    }
  }

  return { lists: allLists, deltaLink: finalDeltaLink };
}
