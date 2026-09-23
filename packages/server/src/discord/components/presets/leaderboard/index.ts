import {
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from "discord.js";
import type {
  LeaderboardConfig,
  LeaderboardEntry,
  LeaderboardType,
} from "@/services/discord/leaderboard";
import type { TopLevelComponent } from "../../component-builder";

const MEDALS = ["🥇", "🥈", "🥉"];

function headUrl(uuid: string): string {
  return `https://mc-heads.net/avatar/${uuid}`;
}

function divider(): SeparatorBuilder {
  return new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small);
}

function entrySection(entry: LeaderboardEntry): SectionBuilder {
  const rank = entry.rank <= 3 ? MEDALS[entry.rank - 1] : `${entry.rank}.`;
  const lines = [
    `## ${rank} ${entry.playerName}`,
    `## ${entry.formattedValue}`,
  ];
  if (entry.subtitle) lines.push(`-# ${entry.subtitle}`);

  return new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join("\n")),
    )
    .setThumbnailAccessory(
      new ThumbnailBuilder()
        .setURL(headUrl(entry.playerUuid))
        .setDescription(`${entry.playerName}'s head`),
    );
}

function footerSection(
  type: LeaderboardType,
  lastRefreshed: Date,
): SectionBuilder {
  const unix = Math.floor(lastRefreshed.getTime() / 1000);
  return new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Last refreshed <t:${unix}:R>`),
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId(`leaderboard:refresh:${type}`)
        .setLabel("Refresh")
        .setEmoji("🔄")
        .setStyle(ButtonStyle.Secondary),
    );
}

/**
 * Builds the Components V2 leaderboard message: a title banner, the top-N
 * entries as sections (player head on the right, separators between), and a
 * footer that pairs a last-refreshed timestamp with the refresh button.
 * Returns the top-level components plus the `IS_COMPONENTS_V2` flag for
 * `messageService.send`/`edit`.
 */
export const LeaderboardComponentPresets = {
  display(
    config: LeaderboardConfig,
    entries: LeaderboardEntry[],
    lastRefreshed: Date,
  ): { components: TopLevelComponent[]; flags: number } {
    const container = new ContainerBuilder();

    if (config.titleImageUrl) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder()
            .setURL(config.titleImageUrl)
            .setDescription(config.title),
        ),
      );
    } else {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# ${config.title}`),
      );
    }

    container.addSeparatorComponents(divider());

    if (entries.length === 0) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "_No players have been tracked yet._",
        ),
      );
      container.addSeparatorComponents(divider());
    } else {
      for (const entry of entries) {
        container.addSectionComponents(entrySection(entry));
        container.addSeparatorComponents(divider());
      }
    }

    container.addSectionComponents(footerSection(config.type, lastRefreshed));

    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    };
  },
};
