import {
  TRPCClientError,
  createTRPCReact,
  httpBatchLink,
} from "@trpc/react-query";
import { QueryClient } from "@tanstack/react-query";
import type { AppRouter } from "@createrington/server/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import { HTTPError } from "ky";
import {
  getAccessToken,
  refreshAccessToken,
} from "@/services/auth/token-manager";

export type RouterOutput = inferRouterOutputs<AppRouter>;

export const trpc = createTRPCReact<AppRouter>();

const MAX_QUERY_RETRIES = 3;

function isClientError(error: unknown): boolean {
  const status =
    error instanceof TRPCClientError
      ? (error.data as { httpStatus?: number } | undefined)?.httpStatus
      : error instanceof HTTPError
        ? error.response.status
        : undefined;
  return status !== undefined && status >= 400 && status < 500;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error) =>
        !isClientError(error) && failureCount < MAX_QUERY_RETRIES,
      refetchOnWindowFocus: false,
    },
  },
});

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/trpc",
      headers() {
        const token = getAccessToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      async fetch(url, options) {
        let response = await fetch(url, {
          ...options,
          credentials: "include",
        });

        // On 401 → attempt silent refresh → retry
        if (response.status === 401) {
          const result = await refreshAccessToken();
          if (result) {
            const headers = new Headers(options?.headers);
            headers.set("Authorization", `Bearer ${result.accessToken}`);
            response = await fetch(url, {
              ...options,
              headers,
              credentials: "include",
            });
          } else {
            window.dispatchEvent(new CustomEvent("auth:session-expired"));
          }
        }

        return response;
      },
    }),
  ],
});
