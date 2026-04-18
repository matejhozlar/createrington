import ky, { type KyInstance, type Options } from "ky";
import {
  getAccessToken,
  refreshAccessToken,
} from "@/services/auth/token-manager";

interface ApiErrorResponse {
  message?: string;
  code?: string;
  [key: string]: unknown;
}

/**
 * Base API client configuration
 *
 * Features:
 * - Automatic JSON parsing
 * - Request/response interceptors
 * - Authentication header injection (in-memory token)
 * - Automatic 401 → silent refresh → retry
 * - Request timeout (30s default)
 * - Retry on network failures (3 attempts)
 */
class ApiClient {
  private client: KyInstance;

  constructor() {
    const apiUrl = this.getApiUrl();

    this.client = ky.create({
      prefixUrl: apiUrl,
      timeout: 30000,
      credentials: "include",
      retry: {
        limit: 3,
        methods: ["get", "head", "options", "put", "delete"],
        statusCodes: [408, 413, 429, 500, 502, 503, 504],
      },
      hooks: {
        beforeRequest: [
          (request) => {
            const token = getAccessToken();
            if (token) {
              request.headers.set("Authorization", `Bearer ${token}`);
            }

            const requestId = crypto.randomUUID();
            request.headers.set("X-Request-ID", requestId);

            if (import.meta.env.DEV) {
              console.log(
                `[API] ${request.method} ${request.url}`,
                request.headers.get("Authorization") ? "🔐" : "",
              );
            }
          },
        ],
        beforeError: [
          async (error) => {
            const { response } = error;

            if (response?.body) {
              try {
                const errorBody = (await response.json()) as ApiErrorResponse;
                error.message = errorBody.message || error.message;
                (error as Error & { code?: string }).code = errorBody.code;
              } catch {
                // Body is not JSON, use default message
              }
            }

            if (import.meta.env.DEV) {
              console.error("[API Error]", {
                url: response?.url,
                status: response?.status,
                message: error.message,
              });
            }

            return error;
          },
        ],
        afterResponse: [
          async (request, options, response) => {
            if (import.meta.env.DEV && response.ok) {
              console.log(`[API] ✓ ${response.status} ${response.url}`);
            }

            // On 401: attempt silent refresh and retry original request.
            if (response.status === 401) {
              // Don't retry the refresh endpoint itself — avoids infinite loops.
              if (request.url.includes("/api/auth/refresh")) {
                return response;
              }

              const result = await refreshAccessToken();
              if (result) {
                request.headers.set(
                  "Authorization",
                  `Bearer ${result.accessToken}`,
                );
                return ky(request, { ...options, hooks: {} });
              }

              window.dispatchEvent(new CustomEvent("auth:session-expired"));
            }

            return response;
          },
        ],
      },
    });
  }

  private getApiUrl(): string {
    const envApiUrl = import.meta.env.VITE_API_URL;

    if (import.meta.env.DEV) {
      console.log(
        "[API Client] Development mode: Using Vite proxy for /api routes",
      );
      return envApiUrl || "/";
    }

    if (!envApiUrl) {
      if (import.meta.env.DEV) {
        console.warn(
          "[API Client] Production mode but VITE_API_URL not set. API calls may fail.",
        );
      }
    }

    if (import.meta.env.DEV) {
      console.log(
        `[API Client] Production mode: API URL = ${envApiUrl || "not set"}`,
      );
    }

    return envApiUrl || "";
  }

  async get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
  ): Promise<T> {
    return this.client
      .get(endpoint, {
        searchParams: this.cleanParams(params),
      })
      .json<T>();
  }

  async post<T>(
    endpoint: string,
    data?: Record<string, unknown>,
    options?: Options,
  ): Promise<T> {
    return this.client
      .post(endpoint, {
        json: data,
        ...options,
      })
      .json<T>();
  }

  async put<T>(
    endpoint: string,
    data?: Record<string, unknown>,
    options?: Options,
  ): Promise<T> {
    return this.client
      .put(endpoint, {
        json: data,
        ...options,
      })
      .json<T>();
  }

  async patch<T>(
    endpoint: string,
    data?: Record<string, unknown>,
    options?: Options,
  ): Promise<T> {
    return this.client
      .patch(endpoint, {
        json: data,
        ...options,
      })
      .json<T>();
  }

  async delete<T>(
    endpoint: string,
    data?: Record<string, unknown>,
    options?: Options,
  ): Promise<T> {
    return this.client
      .delete(endpoint, {
        json: data,
        ...options,
      })
      .json<T>();
  }

  async upload<T>(
    endpoint: string,
    file: File | File[],
    additionalData?: Record<string, string | number | boolean>,
  ): Promise<T> {
    const formData = new FormData();

    if (Array.isArray(file)) {
      file.forEach((f) => formData.append("files", f));
    } else {
      formData.append("file", file);
    }

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
    }

    return this.client
      .post(endpoint, {
        body: formData,
      })
      .json<T>();
  }

  /** Get raw response — useful for downloads or blobs. */
  async getRaw(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
  ): Promise<Response> {
    return this.client.get(endpoint, {
      searchParams: this.cleanParams(params),
    });
  }

  async download(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
  ): Promise<Blob> {
    const response = await this.getRaw(endpoint, params);
    return response.blob();
  }

  private cleanParams(
    params?: Record<string, string | number | boolean>,
  ): Record<string, string> {
    if (!params) return {};

    return Object.entries(params).reduce(
      (acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          acc[key] = String(value);
        }
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  /** Get the underlying Ky instance for advanced usage. */
  getClient(): KyInstance {
    return this.client;
  }
}

export const api = new ApiClient();
