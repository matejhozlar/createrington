import { getServiceSync, Services } from "@/services";
import type { SettingKey, SettingValueOf } from "./registry";
import { SETTINGS_REGISTRY } from "./registry";

// Falls back to the compiled default when the service is not yet initialised
// (boot order, tests) so call sites stay synchronous and DI-free.
export function cryptoSetting<K extends SettingKey>(key: K): SettingValueOf<K> {
  try {
    const svc = getServiceSync(Services.CRYPTO_SETTINGS_SERVICE);
    return svc.get(key);
  } catch {
    return SETTINGS_REGISTRY[key].defaultValue as SettingValueOf<K>;
  }
}
