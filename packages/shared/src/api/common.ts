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
