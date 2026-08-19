import { z } from "zod";
import config from "@/config";
import { Q } from "@/db";

export type IntakeMode = "auto" | "closed";

export const intakeModeSchema = z.enum(["auto", "closed"]);
export const playerLimitSchema = z.number().int().min(0).max(1000);

const SettingKeys = {
  playerLimit: "player_limit",
  intakeMode: "intake_mode",
} as const;

const CACHE_TTL_MS = 10_000;

/**
 * Runtime application settings backed by the app_setting table. Each key
 * carries a zod schema and a fallback (env-derived where one exists), so a
 * missing or malformed row degrades to the configured default. Reads are
 * cached briefly; writes invalidate the cache immediately. The cache is
 * per-instance: under horizontal scaling, other instances serve a stale
 * value for up to the cache TTL after an update. Stored values are wrapped
 * in a `{ value }` envelope so scalar settings fit the jsonb column and its
 * generated Record type cleanly.
 */
export class SettingsService {
  private cache = new Map<string, { value: unknown; fetchedAt: number }>();

  private async read<T>(
    key: string,
    schema: z.ZodType<T>,
    fallback: T,
  ): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.value as T;
    }

    let row;
    try {
      row = await Q.app.setting.find({ key });
    } catch (error) {
      logger.error(`Setting "${key}" read failed:`, error);
      return fallback;
    }

    let value = fallback;
    if (row) {
      const parsed = z.object({ value: schema }).safeParse(row.value);
      if (parsed.success) {
        value = parsed.data.value;
      } else {
        logger.warn(`Setting "${key}" holds an invalid value, using fallback`);
      }
    }

    this.cache.set(key, { value, fetchedAt: Date.now() });
    return value;
  }

  private async write(
    key: string,
    value: unknown,
    updatedBy: string,
  ): Promise<void> {
    await Q.app.setting.upsert(
      { key, value: { value }, updatedAt: new Date(), updatedBy },
      "key",
      ["value", "updatedAt", "updatedBy"],
    );
    this.cache.delete(key);
  }

  /** Maximum registered players before intake flips to waitlist mode. */
  async getPlayerLimit(): Promise<number> {
    return this.read(
      SettingKeys.playerLimit,
      playerLimitSchema,
      config.servers.playerLimit,
    );
  }

  /** Whether intake follows capacity ("auto") or is force-closed ("closed"). */
  async getIntakeMode(): Promise<IntakeMode> {
    return this.read(SettingKeys.intakeMode, intakeModeSchema, "auto");
  }

  /** Update the player limit; the change takes effect within the cache TTL. */
  async setPlayerLimit(value: number, updatedBy: string): Promise<void> {
    await this.write(
      SettingKeys.playerLimit,
      playerLimitSchema.parse(value),
      updatedBy,
    );
  }

  /** Update the intake mode; the change takes effect within the cache TTL. */
  async setIntakeMode(value: IntakeMode, updatedBy: string): Promise<void> {
    await this.write(
      SettingKeys.intakeMode,
      intakeModeSchema.parse(value),
      updatedBy,
    );
  }
}

export const settings = new SettingsService();
