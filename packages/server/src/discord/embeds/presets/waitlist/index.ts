import { createEmbed, DiscordEmbedBuilder } from "../../embed-builder";
import { EmbedColors } from "../../colors";
import { ActionRowBuilder, ButtonBuilder, User } from "discord.js";
import { ButtonPresets } from "../buttons";
import type { Player, WaitlistEntry } from "@/generated/db";

export const WaitlistEmbedPresets = {
  /**
   * Admin notification for new waitlist submission
   */
  adminNotification(data: { id: number; discordName: string; email: string }) {
    const embed = createEmbed()
      .title("📥 New Waitlist Submission")
      .color(EmbedColors.Info)
      .field("🆔 Submission ID", data.id.toString())
      .field("💬 Discord", data.discordName)
      .field("📧 Email", data.email)
      .build();

    // Use reusable button presets
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ButtonPresets.waitlist.accept(data.id),
      ButtonPresets.waitlist.decline(data.id),
    );

    const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ButtonPresets.links.adminPanel(),
    );

    return { embed, components: [actionRow, linkRow] };
  },

  /**
   * Auto-invite notification (no action buttons, just admin panel link)
   */
  autoInviteNotification(data: {
    id: number;
    discordName: string;
    email: string;
    success: boolean;
    botMention: string;
  }) {
    const embed = createEmbed()
      .title("📥 New Waitlist Submission")
      .color(data.success ? EmbedColors.Success : EmbedColors.Error)
      .field("🆔 Submission ID", data.id.toString())
      .field("💬 Discord", data.discordName)
      .field("📧 Email", data.email)
      .build();

    const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ButtonPresets.links.adminPanel(),
    );

    const content = data.success
      ? `✅ Accepted by ${data.botMention}`
      : "Auto-invite attempted — please review.";

    return { embed, components: [linkRow], content };
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
      {
        name: "Accepted",
        done: entry.status === "accepted",
        timestamp: entry.acceptedAt,
      },
      { name: "Joined Discord", done: entry.joinedDiscord },
      { name: "Verified", done: entry.verified },
      { name: "Registered", done: entry.registered },
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
      .color(percent === 100 ? EmbedColors.Success : EmbedColors.Info)
      .description(`${bar}  **${percent}%**  (${completed}/${total})`);

    if (discordUser) {
      embed
        .field("Discord User", `<@${discordUser.id}>`, true)
        .field("Discord ID", `\`${discordUser.id}\``, true)
        .thumbnail(discordUser.displayAvatarURL({ size: 128 }));
    } else {
      embed.field("Discord Name", `\`${entry.discordName}\``, true);
    }

    embed.field("Entry ID", `\`${entry.id}\``, true);

    embed.field("Steps", stepsText, false);

    const details: string[] = [];

    if (player) {
      details.push(`Minecraft: \`${player.minecraftUsername || "Unknown"}\``);
      details.push(`UUID: \`${player.minecraftUuid}\``);
    }

    if (entry.acceptedBy) {
      details.push(`Accepted by: <@${entry.acceptedBy}>`);
    }

    if (entry.acceptedAt) {
      details.push(
        `Accepted: <t:${Math.floor(entry.acceptedAt.getTime() / 1000)}:R>`,
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
