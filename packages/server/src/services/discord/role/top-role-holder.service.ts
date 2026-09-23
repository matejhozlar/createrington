import { createCanvas, loadImage } from "@napi-rs/canvas";
import { Q } from "@/db";
import { objectStorage } from "@/services/storage";
import {
  getSkinApiClient,
  MAX_QUALITY_RENDER,
  POSE_RENDER_STYLE,
} from "@/services/skin-api";
import { getTopRoleRules } from "./config";
import { RoleConditionType } from "./types";
import type { TopRoleRule } from "./types";

const FIGURE_MAX_HEIGHT = 1200;
const FIGURE_WEBP_QUALITY = 90;
const FIGURE_KEY_PREFIX = "top-roles";

export type TopRoleMetric = "playtime" | "balance" | "records";

export interface TopRoleHolderInput {
  discordId: string;
  minecraftUuid: string;
  minecraftUsername: string;
  value: number;
}

export interface TopRoleHolderView {
  discordId: string;
  minecraftUuid: string;
  minecraftUsername: string;
  value: number;
  heldSince: Date;
  imageUrl: string | null;
}

export interface TopRoleView {
  roleKey: string;
  label: string;
  metric: TopRoleMetric;
  pose: string;
  holder: TopRoleHolderView | null;
}

const METRIC_BY_CONDITION: Record<TopRoleRule["conditionType"], TopRoleMetric> =
  {
    [RoleConditionType.TOP_PLAYTIME]: "playtime",
    [RoleConditionType.TOP_BALANCE]: "balance",
    [RoleConditionType.TOP_STAT_RECORDS]: "records",
  };

/**
 * Persists who currently holds each competitive top-1 role so the website can
 * show the holders without asking Discord, and keeps a pre-rendered hero
 * figure of each holder in object storage. `record` is called by the daily
 * role reconcile once the Discord role is confirmed on the leader: a new
 * holder resets `heldSince` and gets a fresh render in the role's hero pose,
 * a returning holder only refreshes the metric. Renders are skipped when
 * object storage is not configured, and a failed render leaves the image
 * empty so the next daily pass retries it; consumers fall back to a plain
 * skin render in that case.
 */
export class TopRoleHolderService {
  /** Stores the confirmed holder of a top role, rendering the hero figure when the holder changed or has no image yet. */
  async record(rule: TopRoleRule, holder: TopRoleHolderInput): Promise<void> {
    const roleKey = rule.gameRankId;
    const existing = await Q.discord.top.role.find({ roleKey });
    const sameHolder = existing?.discordId === holder.discordId;

    let imageKey = sameHolder ? (existing?.imageKey ?? null) : null;
    if (!imageKey && objectStorage.enabled) {
      imageKey = await this.renderFigure(rule, holder.minecraftUuid);
    }

    await Q.discord.top.role.upsert(
      {
        roleKey,
        discordId: holder.discordId,
        minecraftUuid: holder.minecraftUuid,
        value: holder.value.toFixed(3),
        heldSince: sameHolder && existing ? existing.heldSince : new Date(),
        imageKey,
        updatedAt: new Date(),
      },
      "roleKey",
    );

    if (existing?.imageKey && existing.imageKey !== imageKey) {
      await this.deleteImage(existing.imageKey);
    }
  }

  /** Forgets the holder of a top role after the Discord role was stripped and nobody could take it over. */
  async clear(rule: TopRoleRule): Promise<void> {
    const existing = await Q.discord.top.role.find({
      roleKey: rule.gameRankId,
    });
    if (!existing) return;

    await Q.discord.top.role.delete({ roleKey: existing.roleKey });
    if (existing.imageKey) await this.deleteImage(existing.imageKey);
  }

  /** Every configured top role in display order with its current holder, or `null` while unclaimed. */
  async list(): Promise<TopRoleView[]> {
    const rules = getTopRoleRules();
    const rows = await Q.discord.top.role.getAll();
    const rowByKey = new Map(rows.map((row) => [row.roleKey, row]));
    const players = rows.length
      ? await Q.player.findAll({
          minecraftUuid: { $in: rows.map((row) => row.minecraftUuid) },
        })
      : [];
    const usernameByUuid = new Map(
      players.map((player) => [player.minecraftUuid, player.minecraftUsername]),
    );

    return rules.map((rule) => {
      const row = rowByKey.get(rule.gameRankId);
      const username = row ? usernameByUuid.get(row.minecraftUuid) : undefined;

      return {
        roleKey: rule.gameRankId,
        label: rule.label,
        metric: METRIC_BY_CONDITION[rule.conditionType],
        pose: rule.heroPose,
        holder:
          row && username
            ? {
                discordId: row.discordId,
                minecraftUuid: row.minecraftUuid,
                minecraftUsername: username,
                value: Number(row.value),
                heldSince: row.heldSince,
                imageUrl: row.imageKey
                  ? objectStorage.publicUrl(row.imageKey)
                  : null,
              }
            : null,
      };
    });
  }

  private async renderFigure(
    rule: TopRoleRule,
    minecraftUuid: string,
  ): Promise<string | null> {
    try {
      const png = await getSkinApiClient().render({
        pose: rule.heroPose,
        source: { uuid: minecraftUuid },
        options: { ...MAX_QUALITY_RENDER, style: POSE_RENDER_STYLE },
      });
      const body = await this.toHeroFigure(png);
      const key = `${FIGURE_KEY_PREFIX}/${rule.gameRankId}/${minecraftUuid}-${Date.now()}.webp`;

      await objectStorage.put({ key, body, contentType: "image/webp" });
      logger.info(
        `Rendered hero figure for top role "${rule.label}" (${minecraftUuid}) at ${key}`,
      );
      return key;
    } catch (error) {
      logger.warn(
        `Failed to render hero figure for top role "${rule.label}" (${minecraftUuid}):`,
        error,
      );
      return null;
    }
  }

  private async toHeroFigure(png: Uint8Array): Promise<Buffer> {
    const image = await loadImage(Buffer.from(png));
    const scale = Math.min(1, FIGURE_MAX_HEIGHT / image.height);
    const width = Math.round(image.width * scale);
    const height = Math.round(image.height * scale);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, width, height);

    return canvas.toBuffer("image/webp", FIGURE_WEBP_QUALITY);
  }

  private async deleteImage(key: string): Promise<void> {
    if (!objectStorage.enabled) return;

    try {
      await objectStorage.delete([key]);
    } catch (error) {
      logger.warn(`Failed to delete stale hero figure ${key}:`, error);
    }
  }
}

export const topRoleHolderService = new TopRoleHolderService();
