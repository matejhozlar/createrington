/**
 * Type-Safe API Response Builder
 *
 * Ensures responses match TypeScript types exactly
 * Handles Date serialization automatically
 * Provides compile-time safety between server and client
 */

import type { Response } from "express";

/**
 * Recursively convert Date objects to ISO strings for JSON serialization
 */
type Serialize<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Array<Serialize<U>>
    : T extends object
      ? { [K in keyof T]: Serialize<T[K]> }
      : T;

/**
 * Base API response structure
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * Type-safe response builder
 *
 * Automatically serializes Dates to ISO strings
 * Ensures response matches declared type
 * Provides compile-time safety
 */
export class TypedResponse {
  /**
   * Send 200 OK response with typed data
   *
   * @example
   * // In controller
   * return TypedResponse.ok<GetPlayerResponse>(res, {
   *   success: true,
   *   data: player, // TypeScript ensures this matches GetPlayerResponse
   * });
   */
  static ok<T extends ApiResponse<unknown>>(res: Response, response: T): void {
    const serialized = this.serialize(response);
    res.status(200).json(serialized);
  }

  /**
   * Send 201 Created response with typed data
   */
  static created<T extends ApiResponse<unknown>>(
    res: Response,
    response: T,
  ): void {
    const serialized = this.serialize(response);
    res.status(201).json(serialized);
  }

  /**
   * Send 204 No Content response
   */
  static noContent(res: Response): void {
    res.status(204).send();
  }

  /**
   * Recursively serialize response, converting Dates to ISO strings
   */
  private static serialize<T>(obj: T): Serialize<T> {
    if (obj === null || obj === undefined) {
      return obj as Serialize<T>;
    }

    if (obj instanceof Date) {
      return obj.toISOString() as Serialize<T>;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.serialize(item)) as Serialize<T>;
    }

    if (typeof obj === "object") {
      const serialized: Record<string, unknown> = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          serialized[key] = this.serialize(obj[key]);
        }
      }
      return serialized as Serialize<T>;
    }

    return obj as Serialize<T>;
  }
}

/**
 * Helper to build response with proper typing
 *
 * @example
 * const response = buildResponse<GetPlayerResponse>({
 *   success: true,
 *   data: player, // Must match PlayerApiData type
 * });
 *
 * return TypedResponse.ok(res, response);
 */
export function buildResponse<T extends ApiResponse<unknown>>(response: T): T {
  return response;
}
