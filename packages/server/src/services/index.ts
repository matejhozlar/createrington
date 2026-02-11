import { container } from "./container";
import { Services, type ServiceKey, type ServiceTypeMap } from "./container";

/**
 * Type-safe service accessors
 *
 * Usage:
 * ```ts
 * import { getService } from "@/services";
 *
 * const ticketService = await getService(Services.TICKET_SERVICE);
 * // ticketService is typed as TicketService automatically
 * ```
 */

export { Services, container };
export type { ServiceTypeMap };

/**
 * Get a service from the container (async)
 */
export async function getService<K extends ServiceKey>(
  key: K,
): Promise<ServiceTypeMap[K]> {
  return container.get<ServiceTypeMap[K]>(key);
}

/**
 * Get a service synchronously (throws if not initialized)
 * Should only be used if the service is 100% already initialized
 */
export function getServiceSync<K extends ServiceKey>(
  key: K,
): ServiceTypeMap[K] {
  return container.getSync<ServiceTypeMap[K]>(key);
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
export async function waitForService<K extends ServiceKey>(
  key: K,
  timeoutMs: number = 30000,
): Promise<ServiceTypeMap[K]> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (isServiceReady(key)) {
      return container.get<ServiceTypeMap[K]>(key);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Service ${key} did not become ready within ${timeoutMs}ms`);
}
