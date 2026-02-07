/**
 * Shared API Utilities
 *
 * Provides type transformation utilities for server and client
 */

/**
 * Recursively converts Date types to string types
 * Used by client to get the actual runtime types after JSON serialization
 */
export type Serialize<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Array<Serialize<U>>
    : T extends object
      ? { [K in keyof T]: Serialize<T[K]> }
      : T;

/**
 * Recursively converts string types back to Date types
 * Used when deserializing on client if you want to parse dates back
 */
export type Deserialize<T> = T extends string
  ? Date | string // Could be either after parsing
  : T extends Array<infer U>
    ? Array<Deserialize<U>>
    : T extends object
      ? { [K in keyof T]: Deserialize<T[K]> }
      : T;

/**
 * Extract just the data portion of a response
 */
export type ResponseData<T extends { data?: any }> = T["data"];

/**
 * Helper to create properly typed API client
 *
 * @example
 * // Define API contract
 * interface GetPlayerApi {
 *   request: { params: { id: string } };
 *   response: GetPlayerResponse;
 * }
 *
 * // Client-side usage
 * const client = createApiClient<GetPlayerApi>();
 * const data = await client.get('/api/players/:id', { params: { id: '123' } });
 * // data is typed as Serialize<GetPlayerResponse>
 */
export type ApiContract<TRequest = any, TResponse = any> = {
  request: TRequest;
  response: TResponse;
};

/**
 * Client-side type for API response (with serialized dates)
 */
export type ClientResponse<T> = Serialize<T>;

/**
 * Server-side type for API response (with Date objects)
 */
export type ServerResponse<T> = T;
