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

/** Custom ID of the button that puts the member in the waitlist queue */
export const WAITLIST_JOIN_BUTTON_ID = "waitlist:join";

/** Custom ID of the button that re-renders the member's queue position */
export const WAITLIST_REFRESH_BUTTON_ID = "waitlist:refresh";

/** Custom ID of the button that removes the member from the queue */
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

/**
 * Components V2 renderings of the waitlist flow inside a member's
 * verification channel while the server is at capacity: the join offer, the
 * live waiting card with queue position (refreshed on demand), and the
 * left-the-queue card. Every method returns the top-level components plus
 * the `IS_COMPONENTS_V2` flag.
 */
export const WaitlistComponentPresets = {
  /** The at-capacity welcome card offering a spot in the queue. */
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

  /** The waiting card: queue position, queued date, refresh and leave buttons. */
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

  /** The card shown after leaving the queue, with the option to rejoin. */
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
