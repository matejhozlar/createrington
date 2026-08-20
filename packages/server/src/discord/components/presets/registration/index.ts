import config from "@/config";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from "discord.js";
import { ComponentColors } from "../../colors";
import {
  buildComponentsMessage,
  type TopLevelComponent,
} from "../../component-builder";
import { CommonComponentPresets } from "../common";
import { Discord } from "@/discord/constants";

/** Custom ID of the button that opens the registration modal */
export const REGISTER_BUTTON_ID = "registration:open";

/** Custom ID of the button that closes a completed registration channel */
export const REGISTER_CLOSE_BUTTON_ID = "registration:close";

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
  const site = config.meta.links.website;
  return text(
    `-# By registering you agree to our [Rules](${site}/rules), [Terms of Service](${site}/terms) and [Privacy Policy](${site}/privacy).`,
  );
}

function registerRow(): ActionRowBuilder<ButtonBuilder> {
  const button = new ButtonBuilder()
    .setCustomId(REGISTER_BUTTON_ID)
    .setLabel("Register")
    .setStyle(ButtonStyle.Primary)
    .setEmoji("🎮");
  return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
}

/**
 * Components V2 renderings of the registration flow that anchors each
 * verification channel: the idle "click Register" card (optionally with the
 * last failure attached), the per-step progress card, the success card with
 * a close button, and error cards. Every method returns the top-level
 * components plus the `IS_COMPONENTS_V2` flag.
 */
export const RegistrationComponentPresets = {
  /** The idle welcome card; a failed attempt re-renders it red with the error and the step it failed at. */
  idle(params: {
    memberMention: string;
    errorMessage?: string;
    failedStep?: string;
  }): RegistrationMessage {
    const container = new ContainerBuilder()
      .setAccentColor(
        params.errorMessage ? ComponentColors.Error : ComponentColors.Success,
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

  /** The in-flight progress card: bar, percentage, and per-step checklist. */
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
      .setAccentColor(
        percent === 100 ? ComponentColors.Success : ComponentColors.Info,
      )
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

  /** The completed-registration card with getting-started links and a close button. */
  success(
    username: string,
    uuid: string,
    autoCloseAt: number,
  ): RegistrationMessage {
    const ch = Discord.Channels;
    const m = ch.mention.bind(ch);

    const channels = [
      m(ch.createringtonOfficial.DOWNLOAD),
      m(ch.createringtonOfficial.RULES),
      m(ch.createringtonOfficial.ROLES),
      m(ch.createringtonOfficial.ANNOUNCEMENTS),
      m(ch.general.COMMANDS),
      m(ch.createringtonOfficial.SUPPORT),
    ].join("  ");

    const closeButton = new ButtonBuilder()
      .setCustomId(REGISTER_CLOSE_BUTTON_ID)
      .setLabel("Close")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🗑️");

    const container = new ContainerBuilder()
      .setAccentColor(ComponentColors.Success)
      .addTextDisplayComponents(
        text("## ✅ Registration Complete!"),
        text(`Welcome to Createrington, **${username}**!`),
      )
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(
        text(
          `**Getting started**\n` +
            `1. Check out the ${m(ch.createringtonOfficial.RULES)} before jumping in\n` +
            `2. Pick your ${m(ch.createringtonOfficial.ROLES)} to customize your experience\n` +
            `3. Download the modpack in ${m(ch.createringtonOfficial.DOWNLOAD)}\n` +
            `4. Join the server and have fun!`,
        ),
        text(`**Useful channels**\n${channels}`),
        text(
          `**📖 Guides**\n` +
            `Our [Guides](${config.meta.links.website}/guides) cover everything from installing and updating the modpack to adding custom mods.`,
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

  /** A plain error card. */
  error(title: string, description: string): RegistrationMessage {
    const { components } = buildComponentsMessage(
      CommonComponentPresets.error(title, description, { accent: true }),
    );
    return { components, flags: MessageFlags.IsComponentsV2 };
  },

  /** An error card with the admin-contact prompt appended. */
  errorWithAdmin(title: string, description: string): RegistrationMessage {
    const { components } = buildComponentsMessage(
      CommonComponentPresets.errorWithAdmin(title, description, {
        accent: true,
      }),
    );
    return { components, flags: MessageFlags.IsComponentsV2 };
  },
};
