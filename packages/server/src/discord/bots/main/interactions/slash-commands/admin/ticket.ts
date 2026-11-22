import { EmbedPresets } from "@/discord/embeds";
import { formatCount } from "@/utils/format";
import { replyError } from "@/discord/utils/interaction-reply";
import { CooldownType } from "@/discord/utils/cooldown";
import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  channelMention,
  userMention,
} from "discord.js";
import { TicketType } from "@/services/discord/tickets";
import { getService, Services } from "@/services";
import { Q } from "@/db";
import config from "@/config";
import type {
  CommandCooldown,
  CommandModule,
  CommandPermissions,
} from "@/discord/bots/common/loaders/command-loader";

const TICKET_PARTY_SERVER_ID = config.servers.rails.id;

const data = new SlashCommandBuilder()
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
          .setDescription("Party to add (every linked member)")
          .setRequired(false)
          .setAutocomplete(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Revoke a user's access to the current ticket")
      .addUserOption((opt) =>
        opt
          .setName("user")
          .setDescription("Discord user to remove")
          .setRequired(true),
      ),
  );

const cooldown: CommandCooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before using the ticket command again!",
};

const permissions: CommandPermissions = {
  requireAdmin: true,
};

async function autocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== "party") {
    await interaction.respond([]);
    return;
  }

  const results = await Q.server.party.getNameMatches(
    TICKET_PARTY_SERVER_ID,
    focused.value ?? "",
    25,
  );

  await interaction.respond(
    results.map((p) => ({
      name: `${p.name} (${formatCount(p.memberCount, "member")})`,
      value: p.teamId,
    })),
  );
}

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const ticketService = await getService(Services.TICKET_SERVICE);

  const subcommand = interaction.options.getSubcommand();
  if (!interaction.channel) {
    await replyError(
      interaction,
      "Error",
      "This command can only be used in a channel.",
    );
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
      `The ticket for user ${userMention(
        user.id,
      )} has been created: ${channelMention(result.ticket.channelId)}`,
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
      await replyError(
        interaction,
        "Not a Ticket",
        "This command can only be used inside a ticket channel.",
      );
      return;
    }

    if (ticket.status === "closed") {
      await replyError(
        interaction,
        "Already Closed",
        "This ticket is already closed.",
      );
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await ticketService.closeTicket(ticket.id, interaction.user.id);

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
      await replyError(
        interaction,
        "Not a Ticket",
        "This command can only be used inside a ticket channel.",
      );
      return;
    }

    const user = interaction.options.getUser("user", false);
    const partyUuid = interaction.options.getString("party", false);

    if (!user && !partyUuid) {
      await replyError(
        interaction,
        "Nothing to Add",
        "Provide a user, a party, or both.",
      );
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
        added.push(userMention(user.id));
      } else if (result.reason === "not-in-guild") {
        skippedNotInGuild.push(userMention(user.id));
      } else {
        skippedChannelError.push(userMention(user.id));
      }
    }

    let partyName: string | null = null;
    if (partyUuid) {
      const party = await Q.server.party.find({
        serverId: TICKET_PARTY_SERVER_ID,
        teamId: partyUuid,
      });

      if (!party) {
        partyName = "(unknown party)";
      } else {
        partyName = party.name;
        const memberUuids = (
          await Q.server.party.member.findAll({ partyId: party.id })
        ).map((m) => m.minecraftUuid);
        const players = await Q.player.findAll({
          minecraftUuid: { $in: memberUuids },
        });
        const linkedByUuid = new Map(
          players.filter((p) => p.discordId).map((p) => [p.minecraftUuid, p]),
        );

        for (const uuid of memberUuids) {
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
              ? `${userMention(p.discordId)} (${p.minecraftUsername})`
              : userMention(p.discordId),
          ]),
        );

        const results = await ticketService.addParticipants(
          interaction.channelId,
          linkedPlayers.map((p) => p.discordId),
        );

        for (const [discordId, result] of results) {
          const label =
            labelByDiscordId.get(discordId) ?? userMention(discordId);
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
    lines.push(`**Added:** ${added.length > 0 ? added.join(", ") : "_none_"}`);
    if (skippedNotLinked.length > 0) {
      lines.push(
        `**Skipped (no linked Discord):** ${skippedNotLinked.join(", ")}`,
      );
    }
    if (skippedNotInGuild.length > 0) {
      lines.push(`**Skipped (not in guild):** ${skippedNotInGuild.join(", ")}`);
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
  } else if (subcommand === "remove") {
    const ticket = await Q.ticket.find({
      channelId: interaction.channelId,
    });

    if (!ticket) {
      await replyError(
        interaction,
        "Not a Ticket",
        "This command can only be used inside a ticket channel.",
      );
      return;
    }

    const user = interaction.options.getUser("user", true);

    if (user.id === ticket.creatorDiscordId) {
      await replyError(
        interaction,
        "Ticket Owner",
        `${userMention(user.id)} owns this ticket and cannot be removed from it. Close the ticket instead.`,
      );
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const result = await ticketService.removeParticipant(
      interaction.channelId,
      user.id,
    );

    if (result.removed) {
      const embed = EmbedPresets.success(
        "Removed from Ticket",
        `${userMention(user.id)} no longer has access to this ticket.`,
      );
      await interaction.editReply({ embeds: [embed.build()] });
    } else if (result.reason === "not-participant") {
      const embed = EmbedPresets.info(
        "Nothing Removed",
        `${userMention(user.id)} was never added to this ticket.`,
      );
      await interaction.editReply({ embeds: [embed.build()] });
    } else {
      await replyError(
        interaction,
        "Ticket Error",
        `Could not remove ${userMention(user.id)} from this ticket. Please try again.`,
      );
    }
  } else {
    await replyError(interaction, "Error", "Invalid subcommand.");
    return;
  }
}

export default {
  data,
  permissions,
  cooldown,
  autocomplete,
  execute,
} satisfies CommandModule;
