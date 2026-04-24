import { AxiosError } from "axios";

/**
 * Axios attaches the full request config (including headers) to its errors,
 * so logging the raw error would leak any secret carried on the request.
 */
export function safeAxiosError(error: unknown): object {
  if (error instanceof AxiosError) {
    return {
      status: error.response?.status,
      statusText: error.response?.statusText,
      code: error.code,
      message: error.message,
    };
  }
  return { message: error instanceof Error ? error.message : String(error) };
}
