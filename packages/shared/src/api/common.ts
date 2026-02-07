/**
 * Common API Types
 *
 * Shared types used across all API endpoints
 */

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Base success response
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Base error response
 */
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    statusCode: number;
    details?: any;
    stack?: string;
  };
}

/**
 * Validation error details
 */
export interface ValidationErrorDetails {
  field: string;
  message: string;
}

/**
 * Common query parameters
 */
export interface CommonQueryParams {
  page?: number;
  limit?: number;
  orderBy: string;
  orderDirection: "asc" | "desc";
}

/**
 * Date range filter
 */
export interface DateRangeFilter {
  after?: string;
  before?: string;
}
