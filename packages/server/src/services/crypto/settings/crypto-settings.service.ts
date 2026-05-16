import { EventEmitter } from "node:events";
import { Q } from "@/db";
import {
  SETTINGS_REGISTRY,
  ALL_SETTING_KEYS,
  type SettingKey,
  type SettingValueOf,
} from "./registry";

export type SettingsChangeEvent = {
  key: SettingKey;
  oldValue: unknown;
  newValue: unknown;
  reset: boolean;
};

/**
 * Runtime-tweakable overlay over `CRYPTO_CONFIG`.
 *
 * Loads any persisted overrides from `crypto_setting` on boot into an
 * in-memory map, falls back to the compiled default declared in the
 * registry for any key without a row. `setting:changed` is emitted on
 * every update/reset so listeners (e.g. CryptoMarketService) can restart
 * intervals when needed.
 */
export class CryptoSettingsService extends EventEmitter {
  private overrides = new Map<SettingKey, unknown>();

  async initialize(): Promise<void> {
    const rows = await Q.crypto.setting.where({}).all();
    for (const row of rows) {
      if (this.isKnownKey(row.key)) {
        const parsed = this.tryValidate(row.key, this.unwrap(row.value));
        if (parsed.ok) {
          this.overrides.set(row.key, parsed.value);
        } else {
          logger.warn(
            `Ignoring invalid crypto_setting override for ${row.key}: ${parsed.error}`,
          );
        }
      } else {
        logger.warn(`Ignoring unknown crypto_setting key: ${row.key}`);
      }
    }
    logger.info(
      `CryptoSettingsService loaded ${this.overrides.size}/${ALL_SETTING_KEYS.length} overrides`,
    );
  }

  /** Synchronous hot-path read. Falls back to compiled default. */
  get<K extends SettingKey>(key: K): SettingValueOf<K> {
    if (this.overrides.has(key)) {
      return this.overrides.get(key) as SettingValueOf<K>;
    }
    return SETTINGS_REGISTRY[key].defaultValue as SettingValueOf<K>;
  }

  isOverridden(key: SettingKey): boolean {
    return this.overrides.has(key);
  }

  /** All keys, with current + default values, for admin UI. */
  list(): Array<{
    key: SettingKey;
    currentValue: unknown;
    defaultValue: unknown;
    isOverridden: boolean;
    group: (typeof SETTINGS_REGISTRY)[SettingKey]["group"];
    label: string;
    description?: string;
  }> {
    return ALL_SETTING_KEYS.map((key) => {
      const def = SETTINGS_REGISTRY[key];
      return {
        key,
        currentValue: this.get(key),
        defaultValue: def.defaultValue,
        isOverridden: this.overrides.has(key),
        group: def.group,
        label: def.label,
        description: def.description,
      };
    });
  }

  /**
   * Validates and persists an override. Throws if validation fails.
   * Emits `setting:changed` after the cache is updated.
   */
  async set<K extends SettingKey>(
    key: K,
    rawValue: unknown,
    updatedByDiscordId: string | null,
  ): Promise<{ oldValue: unknown; newValue: SettingValueOf<K> }> {
    const parsed = this.tryValidate(key, rawValue);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }
    const oldValue = this.get(key);
    const newValue = parsed.value as SettingValueOf<K>;

    const existing = await Q.crypto.setting.where({ key }).first();
    if (existing) {
      await Q.crypto.setting.update(
        { key },
        {
          value: this.wrap(newValue),
          updatedAt: new Date(),
          updatedByDiscordId,
        },
      );
    } else {
      await Q.crypto.setting.create({
        key,
        value: this.wrap(newValue),
        updatedByDiscordId,
      });
    }

    this.overrides.set(key, newValue);
    this.emit("setting:changed", {
      key,
      oldValue,
      newValue,
      reset: false,
    } satisfies SettingsChangeEvent);

    return { oldValue, newValue };
  }

  /** Removes the override row; subsequent reads return the compiled default. */
  async reset<K extends SettingKey>(
    key: K,
    _updatedByDiscordId: string | null,
  ): Promise<{ oldValue: unknown; newValue: SettingValueOf<K> }> {
    const oldValue = this.get(key);
    await Q.crypto.setting.delete({ key });
    this.overrides.delete(key);
    const newValue = SETTINGS_REGISTRY[key].defaultValue as SettingValueOf<K>;
    this.emit("setting:changed", {
      key,
      oldValue,
      newValue,
      reset: true,
    } satisfies SettingsChangeEvent);
    return { oldValue, newValue };
  }

  /** Deletes every override row. Emits one `setting:changed` per cleared key. */
  async resetAll(_updatedByDiscordId: string | null): Promise<number> {
    const cleared: Array<{ key: SettingKey; oldValue: unknown }> = [];
    for (const key of this.overrides.keys()) {
      cleared.push({ key, oldValue: this.get(key) });
    }

    await Q.crypto.setting.drop();
    this.overrides.clear();

    for (const { key, oldValue } of cleared) {
      this.emit("setting:changed", {
        key,
        oldValue,
        newValue: SETTINGS_REGISTRY[key].defaultValue,
        reset: true,
      } satisfies SettingsChangeEvent);
    }
    return cleared.length;
  }

  private isKnownKey(key: string): key is SettingKey {
    return Object.prototype.hasOwnProperty.call(SETTINGS_REGISTRY, key);
  }

  // jsonb columns are stored as `{ v: <value> }` so primitives (numbers, booleans)
  // round-trip through PostgreSQL without coercion.
  private wrap(value: unknown): Record<string, unknown> {
    return { v: value };
  }

  private unwrap(value: unknown): unknown {
    if (
      value !== null &&
      typeof value === "object" &&
      "v" in (value as Record<string, unknown>)
    ) {
      return (value as Record<string, unknown>).v;
    }
    return value;
  }

  private tryValidate<K extends SettingKey>(
    key: K,
    rawValue: unknown,
  ): { ok: true; value: SettingValueOf<K> } | { ok: false; error: string } {
    const def = SETTINGS_REGISTRY[key];
    const result = def.validator.safeParse(rawValue);
    if (result.success) {
      return { ok: true, value: result.data as SettingValueOf<K> };
    }
    return {
      ok: false,
      error: result.error.issues
        .map((i) => `${i.path.join(".") || "value"}: ${i.message}`)
        .join("; "),
    };
  }
}
