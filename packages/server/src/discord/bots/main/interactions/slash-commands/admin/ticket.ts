import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { TicketType } from "@/services/discord/tickets";
import { Discord } from "@/discord/constants";
import { getService, Services } from "@/services";
import { Q } from "@/db";

const TICKET_PARTY_SERVER_ID = 1;

/**
 * Slash command definition for the ticket command
 * Admin-only command to manually manage ticket operations
 */
export const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Manage tickets")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName("open")
      .setDescription("Open a ticket for a user")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("Discord user").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("close")
      .setDescription("Close the ticket in the current channel"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Grant a user or party access to the current ticket")
      .addUserOption((opt) =>
        opt
          .setName("user")
          .setDescription("Discord user to add")
          .setRequired(false),
      )
      .addStringOption((opt) =>
        opt
          .setName("party")
          .setDescription("OPAC party to add (every linked member)")
          .setRequired(false)
          .setAutocomplete(true),
      ),
  );

export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before using the ticket command again!",
};

export const permissions = {
  requireAdmin: true,
};

export async function autocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== "party") {
    await interaction.respond([]);
    return;
  }

  const results = await Q.server.forceload.party.searchByName(
    TICKET_PARTY_SERVER_ID,
    focused.value ?? "",
    25,
  );

  await interaction.respond(
    results.map((p) => ({
      name: `${p.partyName} (${p.memberCount} member${p.memberCount === 1 ? "" : "s"})`,
      value: p.partyUuid,
    })),
  );
}

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const ticketService = await getService(Services.TICKET_SERVICE);

  const subcommand = interaction.options.getSubcommand();
  try {
    if (!interaction.channel) {
      const embed = EmbedPresets.error(
        "Error",
        "This command can only be used in a channel.",
      );
      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === "open") {
      const user = interaction.options.getUser("user", true);

      const result = await ticketService.createTicket({
        type: TicketType.GENERAL,
        creatorId: user.id,
      });

      const embed = EmbedPresets.success(
        "Ticket Created",
        `The ticket for user ${Discord.Users.mention(
          user.id,
        )} has been created: ${Discord.Channels.mention(
          result.ticket.channelId,
        )}`,
      );

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
    } else if (subcommand === "close") {
      const ticket = await Q.ticket.find({
        channelId: interaction.channelId,
      });

      if (!ticket) {
        const embed = EmbedPresets.error(
          "Not a Ticket",
          "This command can only be used inside a ticket channel.",
        );
        await interaction.reply({
          embeds: [embed.build()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (ticket.status === "closed") {
        const embed = EmbedPresets.error(
          "Already Closed",
          "This ticket is already closed.",
        );
        await interaction.reply({
          embeds: [embed.build()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await ticketService.closeTicket(ticket.id, interaction.user.id, false);

      const embed = EmbedPresets.success(
        "Ticket Closed",
        "This ticket has been closed.",
      );
      await interaction.editReply({ embeds: [embed.build()] });
    } else if (subcommand === "add") {
      const ticket = await Q.ticket.find({
        channelId: interaction.channelId,
      });

      if (!ticket) {
        const embed = EmbedPresets.error(
          "Not a Ticket",
          "This command can only be used inside a ticket channel.",
        );
        await interaction.reply({
          embeds: [embed.build()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const user = interaction.options.getUser("user", false);
      const partyUuid = interaction.options.getString("party", false);

      if (!user && !partyUuid) {
        const embed = EmbedPresets.error(
          "Nothing to Add",
          "Provide a user, a party, or both.",
        );
        await interaction.reply({
          embeds: [embed.build()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const added: string[] = [];
      const skippedNotInGuild: string[] = [];
      const skippedNotLinked: string[] = [];
      const skippedChannelError: string[] = [];

      if (user) {
        const result = await ticketService.addParticipant(
          interaction.channelId,
          user.id,
        );
        if (result.added) {
          added.push(Discord.Users.mention(user.id));
        } else if (result.reason === "not-in-guild") {
          skippedNotInGuild.push(Discord.Users.mention(user.id));
        } else {
          skippedChannelError.push(Discord.Users.mention(user.id));
        }
      }

      let partyName: string | null = null;
      if (partyUuid) {
        const party = await Q.server.forceload.party.getPartyMembers(
          TICKET_PARTY_SERVER_ID,
          partyUuid,
        );

        if (!party) {
          partyName = "(unknown party)";
        } else {
          partyName = party.partyName;
          const players = await Q.player.findAll({
            minecraftUuid: { $in: party.memberUuids },
          });
          const linkedByUuid = new Map(
            players.filter((p) => p.discordId).map((p) => [p.minecraftUuid, p]),
          );

          for (const uuid of party.memberUuids) {
            if (!linkedByUuid.has(uuid)) {
              const fallback = players.find((p) => p.minecraftUuid === uuid);
              skippedNotLinked.push(fallback?.minecraftUsername ?? uuid);
            }
          }

          const linkedPlayers = [...linkedByUuid.values()];
          const labelByDiscordId = new Map<string, string>(
            linkedPlayers.map((p) => [
              p.discordId,
              p.minecraftUsername
                ? `${Discord.Users.mention(p.discordId)} (${p.minecraftUsername})`
                : Discord.Users.mention(p.discordId),
            ]),
          );

          const results = await ticketService.addParticipants(
            interaction.channelId,
            linkedPlayers.map((p) => p.discordId),
          );

          for (const [discordId, result] of results) {
            const label =
              labelByDiscordId.get(discordId) ??
              Discord.Users.mention(discordId);
            if (result.added) {
              added.push(label);
            } else if (result.reason === "not-in-guild") {
              skippedNotInGuild.push(label);
            } else {
              skippedChannelError.push(label);
            }
          }
        }
      }

      const lines: string[] = [];
      if (partyName) lines.push(`**Party:** ${partyName}`);
      lines.push(
        `**Added:** ${added.length > 0 ? added.join(", ") : "_none_"}`,
      );
      if (skippedNotLinked.length > 0) {
        lines.push(
          `**Skipped (no linked Discord):** ${skippedNotLinked.join(", ")}`,
        );
      }
      if (skippedNotInGuild.length > 0) {
        lines.push(
          `**Skipped (not in guild):** ${skippedNotInGuild.join(", ")}`,
        );
      }
      if (skippedChannelError.length > 0) {
        lines.push(
          `**Skipped (channel error):** ${skippedChannelError.join(", ")}`,
        );
      }

      const embed =
        added.length > 0
          ? EmbedPresets.success("Added to Ticket", lines.join("\n"))
          : EmbedPresets.info("Nothing Added", lines.join("\n"));

      await interaction.editReply({ embeds: [embed.build()] });
    } else {
      const embed = EmbedPresets.error("Error", "Invalid subcommand.");

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  } catch (error) {
    logger.error("/ticket failed:", error);
    const embed = EmbedPresets.error(
      "Ticket Error",
      "Something went wrong while executing the command. Please try again.",
    );

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [embed.build()] });
    } else {
      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
