import type { Response } from "express";

/**
 * Standard API response format
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * Response helper utilities
 *
 * Provides convenient methods for sending standardized API responses
 */
export class ResponseHelpers {
  /**
   * Initialize response helpers by extending Express Response prototype
   */
  static initialize(): void {
    const proto = Object.getPrototypeOf({} as Response) as any;

    /**
     * Sends 200 OK with response data
     *
     * @param data - Response data
     * @param message - Optional success message
     */
    if (!proto.ok) {
      proto.ok = function <T>(this: Response, data: T, message?: string): void {
        const response: ApiResponse<T> = {
          success: true,
          data,
          ...(message && { message }),
        };
        this.status(200).json(response);
      };
    }

    /**
     * Send 201 Created response with data
     *
     * @param data - Response data
     * @param message - Optional success message
     */
    if (!proto.created) {
      proto.created = function <T>(
        this: Response,
        data: T,
        message?: string,
      ): void {
        const response: ApiResponse<T> = {
          success: true,
          data,
          ...(message && { message }),
        };
        this.status(201).json(response);
      };
    }

    /**
     * Send 204 No Content response
     */
    if (!proto.noContent) {
      proto.noContent = function (this: Response): void {
        this.status(204).send();
      };
    }
  }
}

/**
 * Legacy response helper functions (for gradual migration)
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
): void => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
  };
  res.status(200).json(response);
};

export const sendCreated = <T>(
  res: Response,
  data: T,
  message?: string,
): void => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
  };
  res.status(201).json(response);
};

export const sendNoContent = (res: Response): void => {
  res.status(204).send();
};
