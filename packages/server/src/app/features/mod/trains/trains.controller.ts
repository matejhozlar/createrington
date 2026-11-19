import { getValidated } from "@/app/middleware/validation.middleware";
import { respondSuccess } from "@/app/middleware/api-envelope";
import { Q } from "@/db";
import { Discord } from "@/discord/constants";
import { createEmbed } from "@/discord/embeds";
import { EmbedColors } from "@/discord/embeds/colors";
import type { Request, Response } from "express";
import type { TrainCrashBody } from "./trains.schemas";

export class TrainsController {
  static async reportCrash(_req: Request, res: Response): Promise<void> {
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
    } = getValidated<{ body: TrainCrashBody }>(res).body;

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
      channelId: Discord.Channels.railsNSails.NOTIFICATIONS,
      content: `||${Discord.Roles.mention(Discord.Roles.RAILSNSAILSNOTIFICATIONS)}||`,
      embeds: embed.build(),
    });

    logger.info(`Train crash reported: ${trainName} (${trainId})`);

    respondSuccess(res, {
      message: `Train crash reported: ${trainName} (${trainId})`,
    });
  }
}
