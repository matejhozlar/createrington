import { createCanvas, loadImage, type Image } from "@napi-rs/canvas";
import { Q } from "@/db";
import { objectStorage } from "@/services/storage";
import {
  getSkinApiClient,
  MAX_QUALITY_RENDER,
  POSE_RENDER_STYLE,
} from "@/services/skin-api";
import { getTopRoleRules } from "./config";
import { outlineOffset, type RgbaImage } from "./figure-outline";
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
  minecraftUuid: string;
  minecraftUsername: string;
  value: number;
  heldSince: Date;
  imageUrl: string | null;
  outlineImageUrl: string | null;
}

interface FigureKeys {
  imageKey: string;
  outlineImageKey: string | null;
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
 * a returning holder only refreshes the metric. Each render comes as a pair,
 * the plain figure and the skin API outline variant framed on one shared
 * canvas so the site can swap them in place. The outline is optional: when it
 * fails to render or line up the holder keeps the plain figure alone until
 * the title changes hands, since a pose that does not align stays that way and
 * retrying would re-render daily. Renders are skipped when
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

    const current: FigureKeys | null =
      sameHolder && existing?.imageKey
        ? {
            imageKey: existing.imageKey,
            outlineImageKey: existing.outlineImageKey,
          }
        : null;
    let figure = current;
    if (!figure && objectStorage.enabled) {
      figure = await this.renderFigures(rule, holder.minecraftUuid);
    }

    await Q.discord.top.role.upsert(
      {
        roleKey,
        discordId: holder.discordId,
        minecraftUuid: holder.minecraftUuid,
        value: holder.value.toFixed(3),
        heldSince: sameHolder && existing ? existing.heldSince : new Date(),
        imageKey: figure?.imageKey ?? null,
        outlineImageKey: figure?.outlineImageKey ?? null,
        updatedAt: new Date(),
      },
      "roleKey",
    );

    const kept = [figure?.imageKey, figure?.outlineImageKey];
    await this.deleteImages(
      [existing?.imageKey, existing?.outlineImageKey].filter(
        (key): key is string => !!key && !kept.includes(key),
      ),
    );
  }

  /** Forgets the holder of a top role after the Discord role was stripped and nobody could take it over. */
  async clear(rule: TopRoleRule): Promise<void> {
    const existing = await Q.discord.top.role.find({
      roleKey: rule.gameRankId,
    });
    if (!existing) return;

    await Q.discord.top.role.delete({ roleKey: existing.roleKey });
    await this.deleteImages(
      [existing.imageKey, existing.outlineImageKey].filter(
        (key): key is string => !!key,
      ),
    );
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
                minecraftUuid: row.minecraftUuid,
                minecraftUsername: username,
                value: Number(row.value),
                heldSince: row.heldSince,
                imageUrl: row.imageKey
                  ? objectStorage.publicUrl(row.imageKey)
                  : null,
                outlineImageUrl:
                  row.imageKey && row.outlineImageKey
                    ? objectStorage.publicUrl(row.outlineImageKey)
                    : null,
              }
            : null,
      };
    });
  }

  private async renderFigures(
    rule: TopRoleRule,
    minecraftUuid: string,
  ): Promise<FigureKeys | null> {
    const render = (outline: boolean) =>
      getSkinApiClient().render({
        pose: rule.heroPose,
        source: { uuid: minecraftUuid },
        options: {
          ...MAX_QUALITY_RENDER,
          style: POSE_RENDER_STYLE,
          ...(outline ? { outline: true } : {}),
        },
      });

    try {
      const [plainPng, outlinePng] = await Promise.all([
        render(false),
        render(true).catch((error) => {
          logger.warn(
            `Failed to render the outlined hero figure for top role "${rule.label}" (${minecraftUuid}):`,
            error,
          );
          return null;
        }),
      ]);
      const plain = await loadImage(Buffer.from(plainPng));
      const outlined = outlinePng
        ? await loadImage(Buffer.from(outlinePng))
        : null;
      const offset = outlined
        ? outlineOffset(this.pixels(plain), this.pixels(outlined))
        : null;
      if (outlined && !offset) {
        logger.warn(
          `Outlined hero figure for top role "${rule.label}" (${minecraftUuid}) did not line up with the plain render, storing the plain figure only`,
        );
      }

      const stem = `${FIGURE_KEY_PREFIX}/${rule.gameRankId}/${minecraftUuid}-${Date.now()}`;
      const imageKey = `${stem}.webp`;
      if (!outlined || !offset) {
        await this.store(imageKey, this.toHeroFigure(plain, plain));
        logger.info(
          `Rendered hero figure for top role "${rule.label}" (${minecraftUuid}) at ${imageKey}`,
        );
        return { imageKey, outlineImageKey: null };
      }

      const outlineImageKey = `${stem}-outline.webp`;
      await Promise.all([
        this.store(imageKey, this.toHeroFigure(plain, outlined, offset)),
        this.store(outlineImageKey, this.toHeroFigure(outlined, outlined)),
      ]);
      logger.info(
        `Rendered hero figures for top role "${rule.label}" (${minecraftUuid}) at ${imageKey} and ${outlineImageKey}`,
      );
      return { imageKey, outlineImageKey };
    } catch (error) {
      logger.warn(
        `Failed to render hero figure for top role "${rule.label}" (${minecraftUuid}):`,
        error,
      );
      return null;
    }
  }

  private pixels(image: Image): RgbaImage {
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    return ctx.getImageData(0, 0, image.width, image.height);
  }

  private async store(key: string, body: Promise<Buffer>): Promise<void> {
    await objectStorage.put({
      key,
      body: await body,
      contentType: "image/webp",
    });
  }

  private async toHeroFigure(
    image: Image,
    frame: { width: number; height: number },
    offset = { x: 0, y: 0 },
  ): Promise<Buffer> {
    const scale = Math.min(1, FIGURE_MAX_HEIGHT / frame.height);
    const canvas = createCanvas(
      Math.round(frame.width * scale),
      Math.round(frame.height * scale),
    );
    const ctx = canvas.getContext("2d");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      image,
      offset.x * scale,
      offset.y * scale,
      image.width * scale,
      image.height * scale,
    );

    return canvas.toBuffer("image/webp", FIGURE_WEBP_QUALITY);
  }

  private async deleteImages(keys: string[]): Promise<void> {
    if (!objectStorage.enabled || keys.length === 0) return;

    try {
      await objectStorage.delete(keys);
    } catch (error) {
      logger.warn(
        `Failed to delete stale hero figures ${keys.join(", ")}:`,
        error,
      );
    }
  }
}

export const topRoleHolderService = new TopRoleHolderService();
