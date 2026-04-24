import { BadRequestError, respondSuccess } from "@/app/middleware";
import { Q } from "@/db";
import { Discord } from "@/discord/constants";
import { createEmbed } from "@/discord/embeds";
import { EmbedColors } from "@/discord/embeds/colors";
import type { Request, Response } from "express";
import { z } from "zod";

const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid UUID",
  );
const playerNameSchema = z.string().min(1).max(32);

const trainCrashSchema = z.object({
  trainId: z.string().min(1).max(100),
  trainName: z.string().min(1).max(100),
  speed: z.number().finite().optional(),
  carriageCount: z.number().int().nonnegative().optional(),
  position: z
    .object({
      x: z.number().finite(),
      y: z.number().finite(),
      z: z.number().finite(),
    })
    .nullable()
    .optional(),
  dimension: z.string().max(100).optional(),
  timestamp: z.number().int().nonnegative().optional(),
  owner: uuidSchema.optional(),
  driverUuid: uuidSchema.optional(),
  passengers: z
    .array(
      z.object({
        uuid: uuidSchema,
        name: playerNameSchema.optional(),
        isDriver: z.boolean(),
      }),
    )
    .max(64)
    .optional(),
  backwardsDriver: z
    .object({ uuid: uuidSchema, name: playerNameSchema.optional() })
    .optional(),
});

/**
 * Trains Controller
 *
 * Handles train crash events reported by the Create: Trains Minecraft mod:
 * - Validates the incoming crash payload
 * - Resolves player display names (with Discord mentions where available)
 * - Sends a formatted notification embed to the Cogs & Steam notifications channel
 */
export class TrainsController {
  /**
   * POST /api/trains/crash
   *
   * Receives train crash data from the Minecraft mod and sends
   * a notification embed to the Cogs & Steam notifications channel.
   */
  static async reportCrash(req: Request, res: Response): Promise<void> {
    const parsed = trainCrashSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError("Invalid train crash payload");
    }
    const {
      trainId,
      trainName,
      speed,
      carriageCount,
      position,
      dimension,
      timestamp,
      owner,
      driverUuid,
      passengers,
      backwardsDriver,
    } = parsed.data;

    // Collect all UUIDs and resolve to usernames in a single query
    const allUuids = new Set<string>();
    if (owner) allUuids.add(owner);
    if (driverUuid) allUuids.add(driverUuid);
    if (backwardsDriver) allUuids.add(backwardsDriver.uuid);
    for (const p of passengers ?? []) allUuids.add(p.uuid);

    const displayMap = new Map<string, string>();
    if (allUuids.size > 0) {
      const players = await Q.player.findAll({
        minecraftUuid: { $in: [...allUuids] },
      });
      for (const p of players) {
        const display = p.discordId
          ? `${p.minecraftUsername} (${Discord.Users.mention(p.discordId)})`
          : p.minecraftUsername;
        displayMap.set(p.minecraftUuid, display);
      }
    }

    const resolveName = (uuid: string, fallbackName?: string) =>
      displayMap.get(uuid) ?? fallbackName ?? uuid;

    const dimensionName = dimension?.split(":").pop() ?? dimension ?? "Unknown";
    const formattedSpeed = speed?.toFixed(1) ?? "Unknown";
    const positionStr = position
      ? `${Math.round(position.x)}, ${Math.round(position.y)}, ${Math.round(position.z)}`
      : "Unknown";
    const crashTime = timestamp
      ? `<t:${Math.floor(timestamp / 1000)}:R>`
      : "Unknown";

    const driver = passengers?.find((p) => p.isDriver);
    const riderList = passengers?.filter((p) => !p.isDriver) ?? [];

    const embed = createEmbed()
      .title("Train Crash")
      .color(EmbedColors.Warning)
      .field("Train", trainName, true)
      .field("Speed", formattedSpeed, true)
      .field("Carriages", String(carriageCount ?? "?"), true)
      .field("Position", positionStr, true)
      .field("Dimension", dimensionName, true)
      .field("Time", crashTime, true);

    if (driver) {
      embed.field("Driver", resolveName(driver.uuid, driver.name), true);
    } else if (driverUuid) {
      embed.field("Driver", resolveName(driverUuid), true);
    }

    if (backwardsDriver) {
      embed.field(
        "Backwards Driver",
        resolveName(backwardsDriver.uuid, backwardsDriver.name),
        true,
      );
    }

    if (riderList.length > 0) {
      const names = riderList
        .map((p) => resolveName(p.uuid, p.name))
        .join(", ");
      embed.field("Passengers", names, false);
    }

    if (owner) {
      embed.field("Owner", resolveName(owner), true);
    }

    embed.footer(`ID: ${trainId}`).timestamp(timestamp ?? Date.now());

    await Discord.Messages.send({
      channelId: Discord.Channels.cogsAndSteam.NOTIFICATIONS,
      content: `||${Discord.Roles.mention(Discord.Roles.COGS_AND_STEAMNOTIFICATIONS)}||`,
      embeds: embed.build(),
    });

    logger.info(`Train crash reported: ${trainName} (${trainId})`);

    respondSuccess(res, {
      message: `Train crash reported: ${trainName} (${trainId})`,
    });
  }
}
