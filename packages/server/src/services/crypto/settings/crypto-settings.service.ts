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
 * In-memory cache of crypto subsystem settings, layered over a compiled registry of defaults.
 * Loads `crypto_setting` overrides on `initialize()`, validates each via the per-key Zod schema
 * (silently dropping invalid or unknown rows), and exposes a synchronous hot-path `get()` so
 * tickers can read settings every loop without hitting the database. Mutations persist, update
 * the cache, and emit `setting:changed`; listeners (e.g. `CryptoMarketService`) use this to
 * restart interval-bound jobs in place.
 */
export class CryptoSettingsService extends EventEmitter {
  private overrides = new Map<SettingKey, unknown>();

  /** Loads persisted overrides into the in-memory cache; invalid or unknown rows are logged and skipped. */
  async initialize(): Promise<void> {
    const rows = await Q.crypto.setting.getAll();
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

  /** Synchronous hot-path read; falls back to the compiled default if no override is set. */
  get<K extends SettingKey>(key: K): SettingValueOf<K> {
    if (this.overrides.has(key)) {
      return this.overrides.get(key) as SettingValueOf<K>;
    }
    return SETTINGS_REGISTRY[key].defaultValue as SettingValueOf<K>;
  }

  /** True if the key has a persisted override; false if the caller is reading the compiled default. */
  isOverridden(key: SettingKey): boolean {
    return this.overrides.has(key);
  }

  /** Every setting key with its current value, default, group, and label (admin UI source). */
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
   * Validates and persists an override, updates the cache, then emits `setting:changed`.
   * Throws if the value fails validation or a paired min/max invariant.
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

    const pairError = this.checkPairInvariant(key, newValue);
    if (pairError) throw new Error(pairError);

    await Q.crypto.setting.upsert(
      {
        key,
        value: this.wrap(newValue),
        updatedAt: new Date(),
        updatedByDiscordId,
      },
      "key",
    );

    this.overrides.set(key, newValue);
    this.emit("setting:changed", {
      key,
      oldValue,
      newValue,
      reset: false,
    } satisfies SettingsChangeEvent);

    return { oldValue, newValue };
  }

  /** Removes the override row, emits `setting:changed` with `reset: true`, and reverts reads to the default. */
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

  // Pairwise invariants the per-key Zod validators can't express.
  private checkPairInvariant<K extends SettingKey>(
    key: K,
    newValue: SettingValueOf<K>,
  ): string | null {
    const pairs: Array<[SettingKey, SettingKey]> = [
      ["MEMECOIN_INITIAL_PRICE_MIN", "MEMECOIN_INITIAL_PRICE_MAX"],
      ["MEMECOIN_TOTAL_SUPPLY_MIN", "MEMECOIN_TOTAL_SUPPLY_MAX"],
      ["ORDER_DEFAULT_EXPIRY_HOURS", "ORDER_MAX_EXPIRY_HOURS"],
    ];
    for (const [minKey, maxKey] of pairs) {
      if (key !== minKey && key !== maxKey) continue;
      const min = (key === minKey ? newValue : this.get(minKey)) as number;
      const max = (key === maxKey ? newValue : this.get(maxKey)) as number;
      if (min > max) {
        return `${minKey} (${min}) cannot exceed ${maxKey} (${max})`;
      }
    }
    return null;
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
