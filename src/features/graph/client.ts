import type { GraphPagedResponse, GraphError, GraphFetchAllResult } from "./types";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const MAX_RETRIES = 3;

type GetTokenFn = () => Promise<string>;

interface FetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

export async function graphFetch<T>(
  path: string,
  getToken: GetTokenFn,
  options?: FetchOptions
): Promise<T> {
  const url = path.startsWith("https://") ? path : `${GRAPH_BASE}${path}`;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    const token = await getToken();
    const response = await fetch(url, {
      method: options?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") ?? "5", 10);
      if (attempt >= MAX_RETRIES) {
        throw new Error(`Rate limited after ${MAX_RETRIES} retries. Retry-After: ${retryAfter}s`);
      }
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      attempt++;
      continue;
    }

    if (response.status === 410) {
      const err = new Error("Delta link expired — full resync required");
      (err as any).code = "GoneError";
      throw err;
    }

    if (response.status === 401) {
      throw new Error("Unauthorized — token may be invalid or expired");
    }

    if (response.ok) {
      return response.json() as Promise<T>;
    }

    // Other 4xx/5xx
    const errorBody: GraphError = await response.json().catch(() => ({
      error: { code: String(response.status), message: response.statusText },
    }));
    const err = new Error(errorBody.error.message);
    (err as any).code = errorBody.error.code;
    throw err;
  }

  throw new Error("Exceeded maximum retries");
}

export async function graphFetchAll<T>(
  path: string,
  getToken: GetTokenFn,
  options?: FetchOptions
): Promise<GraphFetchAllResult<T>> {
  const allItems: T[] = [];
  let nextUrl: string | null = path;
  let deltaLink: string | undefined;

  while (nextUrl) {
    const page: GraphPagedResponse<T> = await graphFetch<GraphPagedResponse<T>>(nextUrl, getToken, options);
    allItems.push(...page.value);

    if (page["@odata.nextLink"]) {
      nextUrl = page["@odata.nextLink"];
    } else {
      deltaLink = page["@odata.deltaLink"];
      nextUrl = null;
    }
  }

  return { value: allItems, deltaLink };
}
