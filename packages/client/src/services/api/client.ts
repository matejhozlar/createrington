import ky, { type KyInstance, type Options } from "ky";

/**
 * Standard API error response structure
 */
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
 * - Authentication header injection
 * - Global error handling
 * - Request timeout (30s default)
 * - Retry on network failures (3 attempts)
 * - Environment-based URL configuration
 */
class ApiClient {
  private client: KyInstance;

  constructor() {
    // Auto-detect API URL based on environment
    const apiUrl = this.getApiUrl();

    this.client = ky.create({
      prefixUrl: apiUrl,
      timeout: 30000, // 30 seconds
      retry: {
        limit: 3,
        methods: ["get", "head", "options", "put", "delete"],
        statusCodes: [408, 413, 429, 500, 502, 503, 504],
      },
      hooks: {
        beforeRequest: [
          (request) => {
            // Add auth token if available
            const token = localStorage.getItem("auth_token");
            if (token) {
              request.headers.set("Authorization", `Bearer ${token}`);
            }

            // Add request ID for tracking
            const requestId = crypto.randomUUID();
            request.headers.set("X-Request-ID", requestId);

            // Log requests in development
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

            // Parse error body if available
            if (response?.body) {
              try {
                const errorBody = (await response.json()) as ApiErrorResponse;
                error.message = errorBody.message || error.message;
                (error as Error & { code?: string }).code = errorBody.code;
              } catch {
                // Body is not JSON, use default message
              }
            }

            // Log errors in development
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
          (_request, _options, response) => {
            // Log successful responses in development
            if (import.meta.env.DEV) {
              console.log(`[API] ✓ ${response.status} ${response.url}`);
            }
            return response;
          },
        ],
      },
    });
  }

  /**
   * Automatically determine API URL based on environment
   */
  private getApiUrl(): string {
    // In development, use empty string (Vite proxy handles /api routes)
    // In production, use environment variable
    const envApiUrl = import.meta.env.VITE_API_URL;

    if (import.meta.env.DEV) {
      console.log(
        "[API Client] Development mode: Using Vite proxy for /api routes",
      );
      return envApiUrl || "";
    }

    if (!envApiUrl) {
      console.warn(
        "[API Client] Production mode but VITE_API_URL not set. API calls may fail.",
      );
    }

    console.log(
      `[API Client] Production mode: API URL = ${envApiUrl || "not set"}`,
    );

    return envApiUrl || "";
  }

  /**
   * GET request
   */
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

  /**
   * POST request
   */
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

  /**
   * PUT request
   */
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

  /**
   * PATCH request
   */
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

  /**
   * DELETE request
   */
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

  /**
   * Upload file(s) with multipart/form-data
   */
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

  /**
   * Get raw response (useful for downloads, blobs, etc.)
   */
  async getRaw(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
  ): Promise<Response> {
    return this.client.get(endpoint, {
      searchParams: this.cleanParams(params),
    });
  }

  /**
   * Download file as blob
   */
  async download(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
  ): Promise<Blob> {
    const response = await this.getRaw(endpoint, params);
    return response.blob();
  }

  /**
   * Clean undefined/null params
   */
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

  /**
   * Update auth token
   */
  setAuthToken(token: string | null): void {
    if (token) {
      localStorage.setItem("auth_token", token);
    } else {
      localStorage.removeItem("auth_token");
    }
  }

  /**
   * Get the underlying Ky instance for advanced usage
   */
  getClient(): KyInstance {
    return this.client;
  }
}

// Export singleton instance
export const api = new ApiClient();
