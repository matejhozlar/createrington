import {
  container,
  Services,
  ServiceState,
  type OptionalServiceKey,
  type OptionalServiceTypeMap,
  type RequiredServiceKey,
  type RequiredServiceTypeMap,
  type ServiceKey,
  type ServiceTypeMap,
} from "./container";

export { Services, ServiceState, container };

/**
 * Get a required service, initialising it on first access
 */
export function getService<K extends RequiredServiceKey>(
  key: K,
): Promise<RequiredServiceTypeMap[K]> {
  return container.get(key);
}

/**
 * Get an optional service, or null when its feature is not configured
 */
export function getOptionalService<K extends OptionalServiceKey>(
  key: K,
): Promise<OptionalServiceTypeMap[K] | null> {
  return container.getOptional(key);
}

/**
 * Get a required service synchronously (throws if not initialized)
 * Should only be used if the service is 100% already initialized
 */
export function getServiceSync<K extends RequiredServiceKey>(
  key: K,
): RequiredServiceTypeMap[K] {
  return container.getSync(key);
}

/**
 * Get a service if it is ready, otherwise null
 */
export function getServiceIfReady<K extends ServiceKey>(
  key: K,
): ServiceTypeMap[K] | null {
  return container.getIfReady(key);
}
