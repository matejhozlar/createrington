import config from "@/config";
import { Q } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import { ButtonPresets } from "@/discord/embeds/presets/buttons";
import { replyError } from "@/discord/utils/interaction-reply";
import { CooldownType } from "@/discord/utils/cooldown";
import { renderScreenshot } from "@/discord/utils/render-screenshot";
import { MC_UUID_REGEX } from "@/utils/zod-schemas";
import {
  DesignCodeError,
  designCode,
  parseDesignCode,
} from "@createrington/shared/team-tag";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  AutocompleteInteraction,
  ButtonBuilder,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  type User,
} from "discord.js";

type TagCard = {
  code: string;
  title: string;
  description?: string;
  color?: number;
};

type TagLookup =
  { ok: true; card: TagCard } | { ok: false; title: string; message: string };

const ATTACHMENT_NAME = "team-tag.png";

export const data = new SlashCommandBuilder()
  .setName("tag")
  .setDescription("Render a team tag")
  .addSubcommand((sub) =>
    sub
      .setName("code")
      .setDescription("Render a team tag from a design code")
      .addStringOption((opt) =>
        opt
          .setName("code")
          .setDescription("Design code from the Team Tag page (CRP1:...)")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("team")
      .setDescription("Render the tag of a team")
      .addStringOption((opt) =>
        opt
          .setName("team")
          .setDescription("Team name or tag")
          .setRequired(true)
          .setAutocomplete(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("player")
      .setDescription("Render the tag of a player's team")
      .addUserOption((opt) =>
        opt
          .setName("player")
          .setDescription("The player (defaults to you)")
          .setRequired(false),
      ),
  );

export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before rendering team tags again!",
};

export async function autocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== "team") {
    await interaction.respond([]);
    return;
  }

  const results = await Q.server.party.searchTagged(
    config.servers.rails.id,
    focused.value ?? "",
    25,
  );

  await interaction.respond(
    results.map((party) => ({
      name: `[${party.tag}] ${party.name}`.slice(0, 100),
      value: party.teamId,
    })),
  );
}

function lookupCode(input: string): TagLookup {
  try {
    const code = designCode(parseDesignCode(input));
    return { ok: true, card: { code, title: "Team Tag Preview" } };
  } catch (error) {
    if (!(error instanceof DesignCodeError)) throw error;
    return { ok: false, title: "Invalid Design Code", message: error.message };
  }
}

async function findParties(value: string) {
  const serverId = config.servers.rails.id;
  if (MC_UUID_REGEX.test(value)) {
    const party = await Q.server.party.find({ serverId, teamId: value });
    return party ? [party] : [];
  }
  return Q.server.party.findAll(
    { serverId, tag: value.toUpperCase() },
    { limit: 2 },
  );
}

async function lookupTeam(input: string): Promise<TagLookup> {
  const value = input.trim();
  const [party, ...others] = await findParties(value);

  if (others.length > 0) {
    return {
      ok: false,
      title: "Ambiguous Tag",
      message: `Several teams use \`${value.toUpperCase()}\`. Pick one from the suggestions.`,
    };
  }
  if (!party) {
    return {
      ok: false,
      title: "Unknown Team",
      message: `No team matches \`${value}\`. Pick one from the suggestions.`,
    };
  }
  if (!party.tagCode) {
    return {
      ok: false,
      title: "No Team Tag",
      message: `**${party.name}** has no team tag yet.`,
    };
  }

  const members = await Q.server.party.member.count({ partyId: party.id });
  return {
    ok: true,
    card: {
      code: party.tagCode,
      title: party.name,
      description: `${members} member${members === 1 ? "" : "s"}`,
      color: party.color,
    },
  };
}

async function lookupPlayer(user: User): Promise<TagLookup> {
  const player = await Q.player.find({ discordId: user.id });
  if (!player) {
    return {
      ok: false,
      title: "Not Registered",
      message: `${user.displayName} is not registered.`,
    };
  }

  const username = player.minecraftUsername;
  const party = await Q.server.party.getForMember(
    config.servers.rails.id,
    player.minecraftUuid,
  );
  if (!party) {
    return {
      ok: false,
      title: "No Team",
      message: `${username} is not in a team.`,
    };
  }
  if (!party.tagCode) {
    return {
      ok: false,
      title: "No Team Tag",
      message: `${username}'s team **${party.name}** has no team tag yet.`,
    };
  }

  return {
    ok: true,
    card: {
      code: party.tagCode,
      title: `${username}'s Team Tag`,
      description: `**${party.name}**`,
      color: party.color,
    },
  };
}

function lookup(interaction: ChatInputCommandInteraction): Promise<TagLookup> {
  switch (interaction.options.getSubcommand()) {
    case "code":
      return Promise.resolve(
        lookupCode(interaction.options.getString("code", true)),
      );
    case "team":
      return lookupTeam(interaction.options.getString("team", true));
    default:
      return lookupPlayer(
        interaction.options.getUser("player", false) ?? interaction.user,
      );
  }
}

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  try {
    const result = await lookup(interaction);
    if (!result.ok) {
      await replyError(interaction, result.title, result.message);
      return;
    }

    const { code, title, description, color } = result.card;
    await interaction.deferReply();

    const screenshotBuffer = await renderScreenshot("tag", { design: code });
    const embed = EmbedPresets.plain({ title, description, color }).field(
      "Design code",
      `\`${code}\``,
    );
    const links = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ButtonPresets.links.teamTag(code),
    );

    if (!screenshotBuffer) {
      await interaction.editReply({
        embeds: [embed.build()],
        components: [links],
      });
      return;
    }

    embed.image(`attachment://${ATTACHMENT_NAME}`);
    await interaction.editReply({
      embeds: [embed.build()],
      files: [
        new AttachmentBuilder(screenshotBuffer, { name: ATTACHMENT_NAME }),
      ],
      components: [links],
    });
  } catch (error) {
    logger.error("/tag failed:", error);
    await replyError(
      interaction,
      "Team Tag Error",
      "Could not render the team tag.",
    );
  }
}
