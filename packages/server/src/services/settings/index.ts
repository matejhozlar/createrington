import { z } from "zod";
import config from "@/config";
import { Q } from "@/db";

export type IntakeMode = "auto" | "closed";

export const intakeModeSchema = z.enum(["auto", "closed"]);
export const playerLimitSchema = z.number().int().min(0).max(1000);
export const galleryRewardAmountSchema = z.number().int().min(0).max(1_000_000);
export const galleryWeeklyRewardCapSchema = z.number().int().min(0).max(100);

export const GALLERY_REWARD_AMOUNT_DEFAULT = 50;
export const GALLERY_WEEKLY_REWARD_CAP_DEFAULT = 3;

const SettingKeys = {
  playerLimit: "player_limit",
  intakeMode: "intake_mode",
  galleryRewardAmount: "gallery_reward_amount",
  galleryWeeklyRewardCap: "gallery_weekly_reward_cap",
} as const;

const CACHE_TTL_MS = 10_000;
const FAILURE_CACHE_TTL_MS = 2_000;

/**
 * Runtime application settings backed by the app_setting table. Each key
 * carries a zod schema and a fallback (env-derived where one exists), so a
 * missing or malformed row degrades to the configured default. Reads are
 * cached briefly (a failed read caches the fallback for an even shorter
 * window so a DB blip is not amplified); writes invalidate the cache
 * immediately. The cache is
 * per-instance: under horizontal scaling, other instances serve a stale
 * value for up to the cache TTL after an update. Stored values are wrapped
 * in a `{ value }` envelope so scalar settings fit the jsonb column and its
 * generated Record type cleanly.
 */
export class SettingsService {
  private cache = new Map<string, { value: unknown; expiresAt: number }>();

  private async read<T>(
    key: string,
    schema: z.ZodType<T>,
    fallback: T,
  ): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value as T;
    }

    let row;
    try {
      row = await Q.app.setting.find({ key });
    } catch (error) {
      logger.error(`Setting "${key}" read failed:`, error);
      this.cache.set(key, {
        value: fallback,
        expiresAt: Date.now() + FAILURE_CACHE_TTL_MS,
      });
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

    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
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

  /** Currency paid to the submitter when a gallery screenshot is approved (0 disables the reward). */
  async getGalleryRewardAmount(): Promise<number> {
    return this.read(
      SettingKeys.galleryRewardAmount,
      galleryRewardAmountSchema,
      GALLERY_REWARD_AMOUNT_DEFAULT,
    );
  }

  /** Maximum rewarded gallery approvals per player in a rolling 7 days; approvals past the cap publish without paying. */
  async getGalleryWeeklyRewardCap(): Promise<number> {
    return this.read(
      SettingKeys.galleryWeeklyRewardCap,
      galleryWeeklyRewardCapSchema,
      GALLERY_WEEKLY_REWARD_CAP_DEFAULT,
    );
  }

  /** Update the gallery reward amount; the change takes effect within the cache TTL. */
  async setGalleryRewardAmount(
    value: number,
    updatedBy: string,
  ): Promise<void> {
    await this.write(
      SettingKeys.galleryRewardAmount,
      galleryRewardAmountSchema.parse(value),
      updatedBy,
    );
  }

  /** Update the weekly gallery reward cap; the change takes effect within the cache TTL. */
  async setGalleryWeeklyRewardCap(
    value: number,
    updatedBy: string,
  ): Promise<void> {
    await this.write(
      SettingKeys.galleryWeeklyRewardCap,
      galleryWeeklyRewardCapSchema.parse(value),
      updatedBy,
    );
  }
}

export const settings = new SettingsService();
