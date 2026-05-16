import { getServiceSync, Services } from "@/services";
import type { SettingKey, SettingValueOf } from "./registry";
import { SETTINGS_REGISTRY } from "./registry";

/**
 * Reads a runtime setting from the global CryptoSettingsService.
 *
 * Falls back to the compiled default if the service is not yet initialised.
 * This keeps call sites (helpers, queries, route handlers) free of dependency
 * injection while still going through the overlay when it is ready.
 */
export function cryptoSetting<K extends SettingKey>(key: K): SettingValueOf<K> {
  try {
    const svc = getServiceSync(Services.CRYPTO_SETTINGS_SERVICE);
    return svc.get(key);
  } catch {
    return SETTINGS_REGISTRY[key].defaultValue as SettingValueOf<K>;
  }
}
