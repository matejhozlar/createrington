import { container } from "./container";
import { Services, type ServiceKey } from "./container";

/**
 * Type-safe service accessors
 *
 * Usage:
 * ```ts
 * import { getService } from "@/services";
 *
 * const ticketService = await getService(Services.TICKET_SERVICE);
 * ```
 */

export { Services, container };

/**
 * Get a service from the container (async)
 */
export async function getService<T>(key: ServiceKey): Promise<T> {
  return container.get<T>(key);
}

/**
 * Get a service synchronously (throws if not initialized)
 * Should only be used if the service is 100% already initialzied
 */
export function getServiceSync<T>(key: ServiceKey): T {
  const service = container.get<T>(key);
  if (service instanceof Promise) {
    throw new Error(
      `Service ${key} is not yet initialized. Use getService() instead`,
    );
  }
  return service as T;
}

/**
 * Check if a service is ready
 */
export function isServiceReady(key: ServiceKey): boolean {
  return container.getState(key) === "ready";
}

/**
 * Wait for a service to be ready
 */
export async function waitForService<T>(
  key: ServiceKey,
  timeoutMs: number = 30000,
): Promise<T> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (isServiceReady(key)) {
      return container.get<T>(key);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Service ${key} did not become ready within ${timeoutMs}ms`);
}
