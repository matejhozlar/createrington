import { BadRequestError } from "@/app/middleware";
import { Q } from "@/db";
import { Discord } from "@/discord/constants";
import { createEmbed } from "@/discord/embeds";
import { EmbedColors } from "@/discord/embeds/colors";
import type { Request, Response } from "express";

interface TrainCrashPassenger {
  uuid: string;
  name?: string;
  isDriver: boolean;
}

interface TrainCrashPayload {
  trainId: string;
  trainName: string;
  speed: number;
  carriageCount: number;
  position: { x: number; y: number; z: number } | null;
  dimension: string;
  timestamp: number;
  owner?: string;
  driverUuid?: string;
  passengers?: TrainCrashPassenger[];
  backwardsDriver?: { uuid: string; name?: string };
}

/**
 * Legacy Trains Controller
 *
 * Pre-envelope, server-IP-only crash endpoint for mod builds that don't yet
 * send a mod JWT to /api/trains/crash and still parse the flat
 * { success: true } response. Served under /api/legacy/trains.
 *
 * Remove this once all mod clients send the mod JWT.
 */
export class LegacyTrainsController {
  static async reportCrash(req: Request, res: Response): Promise<void> {
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
    } = req.body as TrainCrashPayload;

    if (!trainId || !trainName) {
      throw new BadRequestError("trainId and trainName are required");
    }

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

    res.json({ success: true });
  }
}
