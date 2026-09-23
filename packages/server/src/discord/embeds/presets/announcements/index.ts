import { EmbedColors } from "../../colors";
import { createEmbed } from "../../embed-builder";
import { discordTimestamp } from "@/utils/format";

export type MaintenanceType = "maintenance" | "modpack_update";

export interface MaintenanceData {
  type: MaintenanceType;
  startsAt: Date;
  estimatedMinutes: number;
}

const MAINTENANCE_CONFIG: Record<
  MaintenanceType,
  { title: string; description: string }
> = {
  maintenance: {
    title: "Server Maintenance",
    description:
      "The server will be going offline for scheduled maintenance to improve stability and performance.",
  },
  modpack_update: {
    title: "Modpack & Server Update",
    description:
      "We're rolling out a modpack and server update to improve stability, performance, and add new content.",
  },
};

export const AnnouncementEmbedPresets = {
  /** Creates a maintenance/update announcement embed with start time, duration, and expected end */
  maintenance(data: MaintenanceData) {
    const cfg = MAINTENANCE_CONFIG[data.type];
    const endTime = new Date(
      data.startsAt.getTime() + data.estimatedMinutes * 60000,
    );

    return createEmbed()
      .title(`🔧 ${cfg.title}`)
      .description(cfg.description)
      .color(EmbedColors.Warning)
      .fields([
        {
          name: "🕒 Starts",
          value: `${discordTimestamp(data.startsAt, "f")} (${discordTimestamp(data.startsAt, "R")})`,
        },
        {
          name: "⏳ Estimated Duration",
          value: `${data.estimatedMinutes} minutes`,
        },
        {
          name: "🔚 Expected End",
          value: `${discordTimestamp(endTime, "f")} (${discordTimestamp(endTime, "R")})`,
        },
      ])
      .footer("Thanks for your patience!")
      .timestamp();
  },

  /** Creates an embed announcing that maintenance has ended and the server is back online */
  maintenanceEnded() {
    return createEmbed()
      .title("✅ Maintenance Complete")
      .description(
        "Server maintenance has been completed and the server is back online.",
      )
      .color(EmbedColors.Success)
      .footer("Thanks for your patience!")
      .timestamp();
  },
};
