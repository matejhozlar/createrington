import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import config from "@/config";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { createMarketEvent } from "./events/news-feed";
import { Q } from "@/db";
import { getLeaderboard } from "./analytics/leaderboard";
import { EVENT_DEFINITIONS } from "./events/event-definitions";
import type { ActiveEvent } from "./events/event-engine";
import { getService } from "@/services";
import { Services } from "../container";
import type { TriggeredAlert } from "./alerts/alert-manager";

function articleUrl(eventId: number): string {
  return `${config.meta.links.website}/crypto/news/${eventId}`;
}

const CRYPTO_ROLE_MENTION = `||${Discord.Roles.mention(Discord.Roles.CRYPTONOTIFICATIONS)}||`;

function readMoreButton(eventId: number): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel("Read more")
        .setURL(articleUrl(eventId)),
    ),
  ];
}

/**
 * Formats a price with appropriate decimal precision based on magnitude.
 *
 * @private
 * @param price - Numeric or decimal string price to format
 * @returns Human-readable price string with a leading "$" sign
 */
function formatPrice(price: string | number): string {
  const num = Number(price);
  if (num === 0) return "$0.00";
  if (num < 0.01) return `$${num.toFixed(6)}`;
  if (num < 1) return `$${num.toFixed(4)}`;
  if (num < 1000) return `$${num.toFixed(2)}`;
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/**
 * Sends a Discord embed announcing a newly listed token and records a news feed event.
 *
 * @param name - Display name of the token (e.g. "DogeMoon")
 * @param symbol - Ticker symbol of the token (e.g. "DGMN")
 * @param price - Starting price as a decimal string
 * @param totalSupply - Total supply as a numeric string
 * @returns Promise that resolves when the notification has been sent
 */
export async function sendNewListingNotification(
  name: string,
  symbol: string,
  price: string,
  totalSupply: string,
): Promise<void> {
  const event = await createMarketEvent({
    type: "new_listing",
    title: `New Token: ${name} (${symbol})`,
    description: `Starting at ${formatPrice(price)} with ${Number(totalSupply).toLocaleString()} total supply`,
    severity: "info",
  }).catch((err) => {
    logger.error("Failed to record listing event:", err);
    return null;
  });

  const embed = EmbedPresets.crypto.newListing({
    name,
    symbol,
    price: formatPrice(price),
    totalSupply: Number(totalSupply).toLocaleString(),
  });

  try {
    await Discord.Messages.send({
      channelId: Discord.Channels.crypto.NEWS,
      content: CRYPTO_ROLE_MENTION,
      embeds: embed.build(),
      components: event ? readMoreButton(event.id) : undefined,
    });
  } catch (err) {
    logger.error("Failed to send new listing notification to Discord:", err);
  }
}

/**
 * Sends a Discord embed announcing an IPO launch with a countdown timer.
 *
 * @param name - Display name of the token
 * @param symbol - Ticker symbol
 * @param ipoPrice - Fixed price during the IPO
 * @param totalSupply - Total supply as a numeric string
 * @param ipoEndsAt - When the IPO window closes
 * @returns Promise that resolves when the notification has been sent
 */
export async function sendIpoAnnouncementNotification(
  name: string,
  symbol: string,
  ipoPrice: string,
  totalSupply: string,
  ipoEndsAt: Date,
): Promise<void> {
  const durationMs = ipoEndsAt.getTime() - Date.now();
  const durationMin = Math.round(durationMs / 60_000);
  const maxPerPlayer = Math.floor(Number(totalSupply) * 0.05);

  const event = await createMarketEvent({
    type: "ipo_launch",
    title: `IPO: ${name} (${symbol})`,
    description: `IPO at ${formatPrice(ipoPrice)} with ${Number(totalSupply).toLocaleString()} supply. Max ${maxPerPlayer.toLocaleString()} per player. Ends <t:${Math.floor(ipoEndsAt.getTime() / 1000)}:R>.`,
    severity: "info",
  }).catch((err) => {
    logger.error("Failed to record IPO launch event:", err);
    return null;
  });

  const embed = EmbedPresets.crypto.ipoAnnouncement({
    name,
    symbol,
    ipoPrice: formatPrice(ipoPrice),
    totalSupply: Number(totalSupply).toLocaleString(),
    maxPerPlayer: maxPerPlayer.toLocaleString(),
    ipoEndsAt: `<t:${Math.floor(ipoEndsAt.getTime() / 1000)}:R>`,
    duration: `${durationMin} minutes`,
  });

  try {
    await Discord.Messages.send({
      channelId: Discord.Channels.crypto.NEWS,
      content: CRYPTO_ROLE_MENTION,
      embeds: embed.build(),
      components: event ? readMoreButton(event.id) : undefined,
    });
  } catch (err) {
    logger.error(
      "Failed to send IPO announcement notification to Discord:",
      err,
    );
  }
}

/**
 * Sends a Discord embed summarizing IPO results after the window closes.
 *
 * @param name - Display name of the token
 * @param symbol - Ticker symbol
 * @param ipoPrice - The fixed IPO price
 * @param totalSold - Number of tokens sold during IPO
 * @param totalSupply - Total supply
 * @param participants - Number of unique players who bought
 * @returns Promise that resolves when the notification has been sent
 */
export async function sendIpoResultNotification(
  name: string,
  symbol: string,
  ipoPrice: string,
  totalSold: bigint,
  totalSupply: bigint,
  participants: number,
): Promise<void> {
  const soldPercent = (Number(totalSold) / Number(totalSupply)) * 100;
  const totalRaised = Number(totalSold) * Number(ipoPrice);

  const event = await createMarketEvent({
    type: "ipo_complete",
    title: `IPO Complete: ${name} (${symbol})`,
    description: `${Number(totalSold).toLocaleString()} tokens sold to ${participants} players, raising ${formatPrice(totalRaised)}. Trading is now open.`,
    severity: "info",
  }).catch((err) => {
    logger.error("Failed to record IPO result event:", err);
    return null;
  });

  const embed = EmbedPresets.crypto.ipoResult({
    name,
    symbol,
    ipoPrice: formatPrice(ipoPrice),
    tokensSold: `${Number(totalSold).toLocaleString()} (${soldPercent.toFixed(1)}%)`,
    totalRaised: formatPrice(totalRaised),
    participants: `${participants}`,
  });

  try {
    await Discord.Messages.send({
      channelId: Discord.Channels.crypto.NEWS,
      content: CRYPTO_ROLE_MENTION,
      embeds: embed.build(),
      components: event ? readMoreButton(event.id) : undefined,
    });
  } catch (err) {
    logger.error("Failed to send IPO result notification to Discord:", err);
  }
}

/**
 * Sends a Discord embed announcing a token crash and records a news feed event.
 *
 * @param name - Display name of the crashed token
 * @param symbol - Ticker symbol of the crashed token
 * @param lastPrice - The price at the time of crash as a decimal string
 * @returns Promise that resolves when the notification has been sent
 */
export async function sendCrashNotification(
  name: string,
  symbol: string,
  lastPrice: string,
): Promise<void> {
  const event = await createMarketEvent({
    type: "crash",
    title: `${name} (${symbol}) Crashed!`,
    description: `Last price was ${formatPrice(lastPrice)}. The token will be delisted in 48 hours.`,
    severity: "critical",
  }).catch((err) => {
    logger.error("Failed to record crash event:", err);
    return null;
  });

  const embed = EmbedPresets.crypto.crash(name, symbol, formatPrice(lastPrice));

  try {
    await Discord.Messages.send({
      channelId: Discord.Channels.crypto.NEWS,
      content: CRYPTO_ROLE_MENTION,
      embeds: embed.build(),
      components: event ? readMoreButton(event.id) : undefined,
    });
  } catch (err) {
    logger.error("Failed to send crash notification to Discord:", err);
  }
}

/**
 * Sends a Discord embed announcing a large trade (whale alert).
 *
 * @param playerName - Display name of the player who made the trade
 * @param tokenSymbol - Symbol of the traded token
 * @param tradeType - Whether the player bought or sold
 * @param amount - Token quantity traded
 * @param totalCost - Total USD value of the trade
 * @returns Promise that resolves when the notification has been sent
 */
export async function sendWhaleAlertNotification(
  playerName: string,
  tokenSymbol: string,
  tradeType: "buy" | "sell",
  amount: string,
  totalCost: string,
  eventId?: number,
): Promise<void> {
  const action = tradeType === "buy" ? "bought" : "sold";

  const embed = EmbedPresets.crypto.whaleAlert(
    playerName,
    action,
    Number(amount).toLocaleString(),
    tokenSymbol,
    formatPrice(totalCost),
  );

  try {
    await Discord.Messages.send({
      channelId: Discord.Channels.crypto.NEWS,
      content: CRYPTO_ROLE_MENTION,
      embeds: embed.build(),
      components: eventId ? readMoreButton(eventId) : undefined,
    });
  } catch (err) {
    logger.error("Failed to send whale alert notification to Discord:", err);
  }
}

/**
 * Sends a Discord embed announcing a market event (bull run, bear market, etc.).
 *
 * Resolves the event definition by type, maps its severity to an embed color,
 * and substitutes the `{token}` placeholder in the description when the event
 * targets a specific token. Duration is shown in hours for events longer than
 * 60 minutes, otherwise in minutes. Instant events (no `activeUntil`) are
 * labelled as "Instant".
 *
 * @param event - The active event to announce
 * @returns Promise that resolves when the notification has been sent
 */
export async function sendMarketEventNotification(
  event: ActiveEvent,
): Promise<void> {
  const def = EVENT_DEFINITIONS[event.type as keyof typeof EVENT_DEFINITIONS];
  if (!def) return;

  let description = def.description;
  if (event.tokenSymbol) {
    // Replace the {token} template placeholder with the bolded token symbol
    description = description.replace("{token}", `**${event.tokenSymbol}**`);
  }

  const embed = EmbedPresets.crypto.marketEvent(
    def.name,
    description,
    def.severity as "info" | "warning" | "critical",
  );

  if (event.activeUntil) {
    const unixEnd = Math.floor(event.activeUntil.getTime() / 1000);
    embed.field("Ends", `<t:${unixEnd}:R>`, true);
  } else {
    embed.field("Type", "Instant", true);
  }

  if (event.tokenSymbol) {
    embed.field("Affected Token", event.tokenSymbol, true);
  }

  try {
    await Discord.Messages.send({
      channelId: Discord.Channels.crypto.NEWS,
      content: CRYPTO_ROLE_MENTION,
      embeds: embed.build(),
      components: readMoreButton(event.eventId),
    });
  } catch (err) {
    logger.error("Failed to send market event notification to Discord:", err);
  }
}

/**
 * Queries the database and returns a live market summary snapshot.
 *
 * Used to power the `/crypto market` Discord command and any surface that
 * needs an at-a-glance view of the current market state.
 *
 * @returns An object containing total market cap, active token counts by
 *   category (stable, blue-chip, memecoin, seasonal), and 24-hour trading
 *   statistics (volume, trade count, unique trader count)
 */
export async function getMarketSummary() {
  const tokens = await Q.crypto.token.where({ isCrashed: false }).all();
  const activeTokens = tokens.filter((t) => !t.delistedAt);

  const totalMarketCap = activeTokens.reduce((sum, t) => {
    return sum + Number(t.price) * Number(t.totalSupply - t.availableSupply);
  }, 0);

  const stableCount = activeTokens.filter(
    (t) => t.category === "stable",
  ).length;
  const bluechipCount = activeTokens.filter(
    (t) => t.category === "blue_chip",
  ).length;
  const memecoinCount = activeTokens.filter(
    (t) => t.category === "memecoin",
  ).length;
  const seasonalCount = activeTokens.filter(
    (t) => t.category === "seasonal",
  ).length;

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const allTxs = await Q.crypto.transaction.where({}).all();
  const dailyTxs = allTxs.filter((tx) => tx.createdAt >= dayAgo);
  const dailyVolume = dailyTxs.reduce(
    (sum, tx) => sum + Math.abs(Number(tx.totalCost)),
    0,
  );
  const uniqueTraders = new Set(dailyTxs.map((tx) => tx.playerMinecraftUuid))
    .size;

  return {
    totalMarketCap,
    activeTokenCount: activeTokens.length,
    stableCount,
    bluechipCount,
    memecoinCount,
    seasonalCount,
    dailyVolume,
    dailyTrades: dailyTxs.length,
    uniqueTraders,
  };
}

/**
 * Generates and sends a weekly market summary to the bot-spam channel.
 *
 * Aggregates data from the past 7 days to produce a snapshot that includes:
 * - Total market cap across all active tokens
 * - Weekly trade volume and unique active trader count
 * - Breakdown of active tokens by category (stable, blue-chip, meme)
 * - Top 5 players by net worth via the leaderboard
 *
 * @returns Promise that resolves when the report has been sent
 */
export async function sendWeeklyMarketReport(): Promise<void> {
  try {
    const tokens = await Q.crypto.token.where({ isCrashed: false }).all();
    const activeTokens = tokens.filter((t) => !t.delistedAt);

    const totalMarketCap = activeTokens.reduce((sum, t) => {
      return sum + Number(t.price) * Number(t.totalSupply - t.availableSupply);
    }, 0);

    const stableCount = activeTokens.filter(
      (t) => t.category === "stable",
    ).length;
    const bluechipCount = activeTokens.filter(
      (t) => t.category === "blue_chip",
    ).length;
    const memecoinCount = activeTokens.filter(
      (t) => t.category === "memecoin",
    ).length;

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const allTxs = await Q.crypto.transaction.where({}).all();
    const weeklyTxs = allTxs.filter((tx) => tx.createdAt >= weekAgo);
    const weeklyVolume = weeklyTxs.reduce(
      (sum, tx) => sum + Math.abs(Number(tx.totalCost)),
      0,
    );
    const uniqueTraders = new Set(weeklyTxs.map((tx) => tx.playerMinecraftUuid))
      .size;

    const topTraders = await getLeaderboard("networth", 5);

    const leaderboardLines =
      topTraders.length > 0
        ? topTraders
            .map(
              (e) => `${e.rank}. **${e.playerName}** — ${formatPrice(e.value)}`,
            )
            .join("\n")
        : "No traders yet";

    const embed = EmbedPresets.crypto.weeklyReport({
      totalMarketCap: formatPrice(totalMarketCap),
      weeklyVolume: formatPrice(weeklyVolume),
      activeTraders: `${uniqueTraders}`,
      activeTokens: `${activeTokens.length} (${stableCount} stable, ${bluechipCount} blue-chip, ${memecoinCount} meme)`,
      totalTrades: `${weeklyTxs.length}`,
      topTraders: leaderboardLines,
    });

    await Discord.Messages.send({
      channelId: Discord.Channels.crypto.NEWS,
      content: CRYPTO_ROLE_MENTION,
      embeds: embed.build(),
    });

    logger.info("Weekly crypto market report sent");
  } catch (err) {
    logger.error("Failed to send weekly market report:", err);
  }
}

/**
 * Sends Discord DMs to players whose price alerts have been triggered.
 *
 * Looks up each player's Discord ID from their Minecraft UUID, then sends
 * a DM with an embed showing the alert details. Failures are logged but
 * do not throw: a single failed DM does not block the rest.
 *
 * @param alerts - Array of triggered alerts to notify
 */
export async function sendPriceAlertDMs(
  alerts: TriggeredAlert[],
): Promise<void> {
  if (alerts.length === 0) return;

  let mainBot;
  try {
    mainBot = await getService(Services.DISCORD_MAIN_BOT);
  } catch {
    logger.warn("Discord bot not available for price alert DMs");
    return;
  }

  for (const alert of alerts) {
    try {
      const player = await Q.player.get({
        minecraftUuid: alert.playerUuid,
      });
      if (!player?.discordId) continue;

      const user = await mainBot.users.fetch(player.discordId);
      const embed = EmbedPresets.crypto.priceAlertTriggered({
        symbol: alert.tokenSymbol,
        direction: alert.direction,
        targetPrice: formatPrice(alert.targetPrice),
        currentPrice: formatPrice(alert.currentPrice),
      });

      await user.send({ embeds: [embed.build()] });
    } catch (err) {
      logger.error(
        `Failed to send price alert DM for alert ${alert.alertId}:`,
        err,
      );
    }
  }
}
