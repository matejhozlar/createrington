import ky, {
  type BeforeErrorHook,
  type HTTPError,
  type KyInstance,
  type Options,
} from "ky";
import {
  getAccessToken,
  retryAfterRefresh,
} from "@/services/auth/token-manager";

interface ApiErrorResponse {
  message?: string;
  error?: { code?: string };
}

export type ApiError = HTTPError & { code?: string };

const readErrorBody: BeforeErrorHook = async (error) => {
  const { response } = error;

  if (response?.body) {
    try {
      const errorBody = await response.json<ApiErrorResponse>();
      error.message = errorBody.message || error.message;
      (error as ApiError).code = errorBody.error?.code;
    } catch {}
  }

  if (import.meta.env.DEV) {
    console.error("[API Error]", {
      url: response?.url,
      status: response?.status,
      message: error.message,
    });
  }

  return error;
};

class ApiClient {
  private client: KyInstance;

  constructor() {
    this.client = ky.create({
      prefixUrl: "/",
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
        beforeError: [readErrorBody],
        afterResponse: [
          async (request, options, response) => {
            if (import.meta.env.DEV && response.ok) {
              console.log(`[API] ✓ ${response.status} ${response.url}`);
            }

            return retryAfterRefresh(response, (accessToken) => {
              request.headers.set("Authorization", `Bearer ${accessToken}`);
              return ky(request, {
                ...options,
                hooks: { beforeError: [readErrorBody] },
              });
            });
          },
        ],
      },
    });
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

  getClient(): KyInstance {
    return this.client;
  }
}

export const api = new ApiClient();
