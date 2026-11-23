import { siteUrl } from "@/config/site-url";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  channelMention,
} from "discord.js";
import { EmbedColors } from "@/discord/embeds/colors";
import {
  buildComponentsMessage,
  type TopLevelComponent,
} from "../../component-builder";
import { CommonComponentPresets } from "../common";
import { Discord } from "@/discord/constants";
import { CustomIds } from "@/discord/custom-ids";

const PROGRESS_BAR_LENGTH = 12;

export interface RegistrationMessage {
  components: TopLevelComponent[];
  flags: MessageFlags.IsComponentsV2;
}

interface RegistrationStepView {
  name: string;
  completed: boolean;
}

function divider(): SeparatorBuilder {
  return new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small);
}

function text(content: string): TextDisplayBuilder {
  return new TextDisplayBuilder().setContent(content);
}

function message(container: ContainerBuilder): RegistrationMessage {
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function termsLine(): TextDisplayBuilder {
  return text(
    `-# By registering you agree to our [Rules](${siteUrl("/rules")}), [Terms of Service](${siteUrl("/terms")}) and [Privacy Policy](${siteUrl("/privacy")}).`,
  );
}

function registerRow(): ActionRowBuilder<ButtonBuilder> {
  const button = new ButtonBuilder()
    .setCustomId(CustomIds.registrationOpen.build())
    .setLabel("Register")
    .setStyle(ButtonStyle.Primary);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
}

export const RegistrationComponentPresets = {
  idle(params: {
    memberMention: string;
    errorMessage?: string;
    failedStep?: string;
  }): RegistrationMessage {
    const container = new ContainerBuilder()
      .setAccentColor(
        params.errorMessage ? EmbedColors.Error : EmbedColors.Success,
      )
      .addTextDisplayComponents(
        text("## 🎉 Welcome to Createrington!"),
        text(
          `Hey ${params.memberMention}, we're so glad you're here.\n\n` +
            `You're one step away from joining the server. Click **Register** below and drop in your Minecraft username, and we'll handle the whitelist and setup for you.\n\n` +
            `See you in-game soon. ⛏️`,
        ),
      );

    if (params.errorMessage) {
      const heading = params.failedStep
        ? `❌ **Last attempt failed at "${params.failedStep}"**`
        : "❌ **Last attempt failed**";
      container
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(text(`${heading}\n${params.errorMessage}`));
    }

    container
      .addSeparatorComponents(divider())
      .addActionRowComponents(registerRow())
      .addTextDisplayComponents(termsLine());

    return message(container);
  },

  progress(
    username: string,
    steps: RegistrationStepView[],
    currentStepIndex: number,
  ): RegistrationMessage {
    const total = steps.length;
    const completed = steps.filter((s) => s.completed).length;
    const percent = Math.round((completed / total) * 100);
    const filled = Math.floor((completed / total) * PROGRESS_BAR_LENGTH);
    const bar = "▰".repeat(filled) + "▱".repeat(PROGRESS_BAR_LENGTH - filled);

    const stepsText = steps
      .map((s, i) => {
        let icon = "·";
        if (s.completed) icon = "✓";
        else if (i === currentStepIndex) icon = "⏳";
        return `${icon} ${s.name}`;
      })
      .join("\n");

    const container = new ContainerBuilder()
      .setAccentColor(percent === 100 ? EmbedColors.Success : EmbedColors.Info)
      .addTextDisplayComponents(
        text("## 🔄 Registering your Minecraft account..."),
        text(`**Username** \`${username}\``),
      )
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(
        text(`${bar}  **${percent}%**  (${completed}/${total})`),
        text(stepsText),
      );

    return message(container);
  },

  success(
    username: string,
    uuid: string,
    autoCloseAt: number,
  ): RegistrationMessage {
    const ch = Discord.Channels;

    const channels = [
      channelMention(ch.createringtonOfficial.DOWNLOAD),
      channelMention(ch.createringtonOfficial.RULES),
      channelMention(ch.createringtonOfficial.ROLES),
      channelMention(ch.createringtonOfficial.ANNOUNCEMENTS),
      channelMention(ch.general.COMMANDS),
      channelMention(ch.createringtonOfficial.SUPPORT),
    ].join("  ");

    const closeButton = new ButtonBuilder()
      .setCustomId(CustomIds.registrationClose.build())
      .setLabel("Close")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🗑️");

    const container = new ContainerBuilder()
      .setAccentColor(EmbedColors.Success)
      .addTextDisplayComponents(
        text("## ✅ Registration Complete!"),
        text(`Welcome to Createrington, **${username}**!`),
      )
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(
        text(
          `**Getting started**\n` +
            `1. Check out the ${channelMention(ch.createringtonOfficial.RULES)} before jumping in\n` +
            `2. Pick your ${channelMention(ch.createringtonOfficial.ROLES)} to customize your experience\n` +
            `3. Download the modpack in ${channelMention(ch.createringtonOfficial.DOWNLOAD)}\n` +
            `4. Join the server and have fun!`,
        ),
        text(`**Useful channels**\n${channels}`),
        text(
          `**📖 Guides**\n` +
            `Our [Guides](${siteUrl("/guides")}) cover everything from installing and updating the modpack to adding custom mods.`,
        ),
        text(
          `**Need help?**\n` +
            `You can ask anything in this channel. Once you're all set, feel free to close it. Otherwise, it will be closed automatically <t:${autoCloseAt}:R>.`,
        ),
      )
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(
        text(`**Minecraft Username** \`${username}\`\n**UUID** \`${uuid}\``),
      )
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton),
      );

    return message(container);
  },

  closing(): RegistrationMessage {
    const container = new ContainerBuilder()
      .setAccentColor(EmbedColors.Error)
      .addTextDisplayComponents(
        text("## 🗑️ Channel Deletion"),
        text("This channel will be deleted in a few seconds..."),
      );

    return message(container);
  },

  error(title: string, description: string): RegistrationMessage {
    const { components } = buildComponentsMessage(
      CommonComponentPresets.error(title, description, { accent: true }),
    );
    return { components, flags: MessageFlags.IsComponentsV2 };
  },

  errorWithAdmin(title: string, description: string): RegistrationMessage {
    const { components } = buildComponentsMessage(
      CommonComponentPresets.errorWithAdmin(title, description, {
        accent: true,
      }),
    );
    return { components, flags: MessageFlags.IsComponentsV2 };
  },
};
