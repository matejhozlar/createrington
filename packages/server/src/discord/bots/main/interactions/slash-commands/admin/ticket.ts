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
import { TicketType, type TicketService } from "@/services/discord/tickets";
import { getService, Services } from "@/services";
import { Q } from "@/db";
import config from "@/config";
import type { Ticket } from "@createrington/shared/db";
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

type AddResult = Awaited<ReturnType<TicketService["addParticipant"]>>;

interface AddOutcome {
  added: string[];
  notInGuild: string[];
  notLinked: string[];
  channelError: string[];
}

type SubcommandHandler = (
  interaction: ChatInputCommandInteraction,
  tickets: TicketService,
) => Promise<void>;

function recordAdd(outcome: AddOutcome, label: string, result: AddResult) {
  if (result.added) {
    outcome.added.push(label);
  } else if (result.reason === "not-in-guild") {
    outcome.notInGuild.push(label);
  } else {
    outcome.channelError.push(label);
  }
}

async function channelTicket(
  interaction: ChatInputCommandInteraction,
): Promise<Ticket | null> {
  const ticket = await Q.ticket.find({ channelId: interaction.channelId });
  if (!ticket) {
    await replyError(
      interaction,
      "Not a Ticket",
      "This command can only be used inside a ticket channel.",
    );
  }
  return ticket;
}

async function openTicket(
  interaction: ChatInputCommandInteraction,
  tickets: TicketService,
): Promise<void> {
  const user = interaction.options.getUser("user", true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await tickets.openTicket({
    type: TicketType.GENERAL,
    creatorId: user.id,
  });

  if (!result.created) {
    await replyError(
      interaction,
      "Ticket Already Open",
      `${userMention(user.id)} already has an open ticket: ${channelMention(
        result.ticket.channelId,
      )}`,
    );
    return;
  }

  const embed = EmbedPresets.success(
    "Ticket Created",
    `The ticket for user ${userMention(
      user.id,
    )} has been created: ${channelMention(result.ticket.channelId)}`,
  );
  await interaction.editReply({ embeds: [embed.build()] });
}

async function closeTicket(
  interaction: ChatInputCommandInteraction,
  tickets: TicketService,
): Promise<void> {
  const ticket = await channelTicket(interaction);
  if (!ticket) return;

  if (ticket.status === "closed" && !tickets.isMissingClosureMessage(ticket)) {
    await replyError(
      interaction,
      "Already Closed",
      "This ticket is already closed.",
    );
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await tickets.closeTicket(ticket.id, interaction.user.id);

  const embed = EmbedPresets.success(
    "Ticket Closed",
    "This ticket has been closed.",
  );
  await interaction.editReply({ embeds: [embed.build()] });
}

async function addPartyMembers(
  interaction: ChatInputCommandInteraction,
  tickets: TicketService,
  partyUuid: string,
  outcome: AddOutcome,
): Promise<string> {
  const party = await Q.server.party.find({
    serverId: TICKET_PARTY_SERVER_ID,
    teamId: partyUuid,
  });
  if (!party) return "(unknown party)";

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
      outcome.notLinked.push(fallback?.minecraftUsername ?? uuid);
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

  const results = await tickets.addParticipants(
    interaction.channelId,
    linkedPlayers.map((p) => p.discordId),
  );
  for (const [discordId, result] of results) {
    recordAdd(
      outcome,
      labelByDiscordId.get(discordId) ?? userMention(discordId),
      result,
    );
  }
  return party.name;
}

function addSummary(outcome: AddOutcome, partyName: string | null): string {
  const lines: string[] = [];
  if (partyName) lines.push(`**Party:** ${partyName}`);
  lines.push(
    `**Added:** ${outcome.added.length > 0 ? outcome.added.join(", ") : "_none_"}`,
  );
  if (outcome.notLinked.length > 0) {
    lines.push(
      `**Skipped (no linked Discord):** ${outcome.notLinked.join(", ")}`,
    );
  }
  if (outcome.notInGuild.length > 0) {
    lines.push(`**Skipped (not in guild):** ${outcome.notInGuild.join(", ")}`);
  }
  if (outcome.channelError.length > 0) {
    lines.push(
      `**Skipped (channel error):** ${outcome.channelError.join(", ")}`,
    );
  }
  return lines.join("\n");
}

async function addToTicket(
  interaction: ChatInputCommandInteraction,
  tickets: TicketService,
): Promise<void> {
  const ticket = await channelTicket(interaction);
  if (!ticket) return;

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

  const outcome: AddOutcome = {
    added: [],
    notInGuild: [],
    notLinked: [],
    channelError: [],
  };
  if (user) {
    recordAdd(
      outcome,
      userMention(user.id),
      await tickets.addParticipant(interaction.channelId, user.id),
    );
  }
  const partyName = partyUuid
    ? await addPartyMembers(interaction, tickets, partyUuid, outcome)
    : null;

  const summary = addSummary(outcome, partyName);
  const embed =
    outcome.added.length > 0
      ? EmbedPresets.success("Added to Ticket", summary)
      : EmbedPresets.info("Nothing Added", summary);
  await interaction.editReply({ embeds: [embed.build()] });
}

async function removeFromTicket(
  interaction: ChatInputCommandInteraction,
  tickets: TicketService,
): Promise<void> {
  const ticket = await channelTicket(interaction);
  if (!ticket) return;

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
  const result = await tickets.removeParticipant(
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
}

const SUBCOMMANDS: Record<string, SubcommandHandler> = {
  open: openTicket,
  close: closeTicket,
  add: addToTicket,
  remove: removeFromTicket,
};

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const ticketService = await getService(Services.TICKET_SERVICE);

  if (!interaction.channel) {
    await replyError(
      interaction,
      "Error",
      "This command can only be used in a channel.",
    );
    return;
  }

  const handler = SUBCOMMANDS[interaction.options.getSubcommand()];
  if (!handler) {
    await replyError(interaction, "Error", "Invalid subcommand.");
    return;
  }
  await handler(interaction, ticketService);
}

export default {
  data,
  permissions,
  cooldown,
  autocomplete,
  execute,
} satisfies CommandModule;
