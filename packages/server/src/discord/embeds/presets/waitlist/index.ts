import { createEmbed, DiscordEmbedBuilder } from "../../embed-builder";
import { EmbedColors } from "../../colors";
import { ActionRowBuilder, ButtonBuilder, User } from "discord.js";
import { ButtonPresets } from "../buttons";
import type { Player, WaitlistEntry } from "@/generated/db";
import type { WaitlistStatus } from "@createrington/shared/db";
import { discordTimestamp } from "@/utils/format";

export const WaitlistEmbedPresets = {
  /**
   * Admin notification for a new waitlist entry (informational only;
   * promotion happens in the admin panel)
   */
  queueNotification(data: {
    id: number;
    discordId: string;
    discordUsername: string;
    status: WaitlistStatus;
  }) {
    const embed = createEmbed()
      .title(
        data.status === "promoted"
          ? "📥 New Registration Started"
          : "📥 New Waitlist Signup",
      )
      .color(
        data.status === "promoted" ? EmbedColors.Success : EmbedColors.Info,
      )
      .field("🆔 Entry ID", data.id.toString())
      .field("💬 Discord", `<@${data.discordId}> (\`${data.discordUsername}\`)`)
      .build();

    const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ButtonPresets.links.adminPanel(),
    );

    return { embed, components: [linkRow] };
  },

  /**
   * Creates a progress embed for admins to see
   */
  createProgressEmbed(
    entry: WaitlistEntry,
    discordUser?: User | null,
    player?: Player | null,
  ): DiscordEmbedBuilder {
    const steps = [
      { name: "Queued", done: true },
      {
        name: "Promoted",
        done: entry.promotedAt !== null || entry.status === "registered",
      },
      { name: "Registered", done: entry.status === "registered" },
      { name: "Joined Minecraft", done: entry.joinedMinecraft },
    ];

    const total = steps.length;
    const completed = steps.filter((s) => s.done).length;
    const percent = Math.round((completed / total) * 100);

    const barLen = 12;
    const filled = Math.round((completed / total) * barLen);
    const bar = "▰".repeat(filled) + "▱".repeat(barLen - filled);

    const stepsText = steps
      .map((s) => `${s.done ? "✓" : "·"} ${s.name}`)
      .join("\n");

    const embed = createEmbed()
      .title("Onboarding Progress")
      .color(
        entry.status === "expired"
          ? EmbedColors.Error
          : percent === 100
            ? EmbedColors.Success
            : EmbedColors.Info,
      )
      .description(`${bar}  **${percent}%**  (${completed}/${total})`);

    if (discordUser) {
      embed
        .field("Discord User", `<@${discordUser.id}>`, true)
        .field("Discord ID", `\`${discordUser.id}\``, true)
        .thumbnail(discordUser.displayAvatarURL({ size: 128 }));
    } else {
      embed.field("Discord Name", `\`${entry.discordUsername}\``, true);
    }

    embed.field("Entry ID", `\`${entry.id}\``, true);

    embed.field("Steps", stepsText, false);

    const details: string[] = [];

    if (player) {
      details.push(`Minecraft: \`${player.minecraftUsername || "Unknown"}\``);
      details.push(`UUID: \`${player.minecraftUuid}\``);
    }

    details.push(`Queued: ${discordTimestamp(entry.queuedAt, "R")}`);

    if (entry.promotedAt) {
      details.push(
        `Promoted: ${discordTimestamp(entry.promotedAt, "R")}${entry.promotedBy ? ` by <@${entry.promotedBy}>` : " (auto)"}`,
      );
    }

    if (entry.registeredAt) {
      details.push(`Registered: ${discordTimestamp(entry.registeredAt, "R")}`);
    }

    if (entry.status === "expired") {
      details.push(
        `Expired${entry.expiredAt ? `: ${discordTimestamp(entry.expiredAt, "R")}` : ""}`,
      );
    }

    if (details.length > 0) {
      embed.field("Details", details.join("\n"), false);
    }

    if (percent === 100) {
      embed.field("Status", "**Completed**", false);
    }

    return embed;
  },
};
