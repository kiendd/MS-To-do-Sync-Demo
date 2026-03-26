import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // 30 seconds — matches our poll interval
      retry: 1,                    // 1 retry on failure (Graph client handles 429 internally)
      refetchOnWindowFocus: true,  // re-sync when tab regains focus
    },
  },
});
