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
import type { TopLevelComponent } from "../../component-builder";
import { discordTimestamp } from "@/utils/format";

export const WAITLIST_JOIN_BUTTON_ID = "waitlist:join";

export const WAITLIST_REFRESH_BUTTON_ID = "waitlist:refresh";

export const WAITLIST_LEAVE_BUTTON_ID = "waitlist:leave";

export interface WaitlistMessage {
  components: TopLevelComponent[];
  flags: MessageFlags.IsComponentsV2;
}

function divider(): SeparatorBuilder {
  return new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small);
}

function text(content: string): TextDisplayBuilder {
  return new TextDisplayBuilder().setContent(content);
}

function message(container: ContainerBuilder): WaitlistMessage {
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function joinButton(): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(WAITLIST_JOIN_BUTTON_ID)
    .setLabel("Join Waitlist")
    .setStyle(ButtonStyle.Primary)
    .setEmoji("📝");
}

function websiteButton(): ButtonBuilder {
  return new ButtonBuilder()
    .setLabel("Visit Website")
    .setStyle(ButtonStyle.Link)
    .setURL(config.meta.links.website);
}

export const WaitlistComponentPresets = {
  queueOffer(params: { memberMention: string }): WaitlistMessage {
    const container = new ContainerBuilder()
      .setAccentColor(ComponentColors.Warning)
      .addTextDisplayComponents(
        text("## 🎉 Welcome to Createrington!"),
        text(
          `Hey ${params.memberMention}, we're glad you're here.\n\n` +
            `The server is currently at capacity, but you can join the waitlist and we'll ping you **right here in this channel** as soon as a spot opens up.`,
        ),
      )
      .addSeparatorComponents(divider())
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          joinButton(),
          websiteButton(),
        ),
      );

    return message(container);
  },

  waiting(params: {
    memberMention: string;
    position: number;
    total: number;
    queuedAt: Date;
  }): WaitlistMessage {
    const site = config.meta.links.website;

    const container = new ContainerBuilder()
      .setAccentColor(ComponentColors.Warning)
      .addTextDisplayComponents(
        text("## ⏳ You're on the waitlist!"),
        text(
          `Hey ${params.memberMention}, you're **#${params.position} of ${params.total}** in line (joined ${discordTimestamp(params.queuedAt, "R")}).\n\n` +
            `We'll ping you right here as soon as a spot opens up. In the meantime, feel free to look around the Discord, check out the [website](${site}) or read up on the [rules](${site}/rules).`,
        ),
      )
      .addSeparatorComponents(divider())
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(WAITLIST_REFRESH_BUTTON_ID)
            .setLabel("Refresh Position")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("🔄"),
          new ButtonBuilder()
            .setCustomId(WAITLIST_LEAVE_BUTTON_ID)
            .setLabel("Leave Waitlist")
            .setStyle(ButtonStyle.Danger),
        ),
      );

    return message(container);
  },

  left(params: { memberMention: string }): WaitlistMessage {
    const container = new ContainerBuilder()
      .setAccentColor(ComponentColors.Neutral)
      .addTextDisplayComponents(
        text("## 👋 You've left the waitlist"),
        text(
          `No hard feelings, ${params.memberMention}. Changed your mind? You can rejoin any time; you'll go to the back of the queue.`,
        ),
      )
      .addSeparatorComponents(divider())
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          joinButton(),
          websiteButton(),
        ),
      );

    return message(container);
  },
};
