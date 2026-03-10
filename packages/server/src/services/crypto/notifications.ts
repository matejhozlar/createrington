import { Discord } from "@/discord/constants";
import { createEmbed, EmbedColors } from "@/discord/embeds";
import { createMarketEvent } from "./events/news-feed";
import { Q } from "@/db";
import { getLeaderboard } from "./analytics/leaderboard";

// ==========================================================================
// HELPERS
// ==========================================================================

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

// ==========================================================================
// EVENT NOTIFICATIONS
// ==========================================================================

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
  const embed = createEmbed()
    .title("New Token Listed!")
    .color(EmbedColors.Success)
    .description(`**${name}** (\`${symbol}\`) is now available for trading!`)
    .field("Starting Price", formatPrice(price), true)
    .field("Total Supply", Number(totalSupply).toLocaleString(), true)
    .footer("Use /crypto buy to start trading")
    .timestamp();

  try {
    await Discord.Messages.send({
      channelId: Discord.Channels.general.BOT_SPAM,
      embeds: embed.build(),
    });
  } catch (err) {
    logger.error("Failed to send new listing notification to Discord:", err);
  }

  createMarketEvent({
    type: "new_listing",
    title: `New Token: ${name} (${symbol})`,
    description: `Starting at ${formatPrice(price)} with ${Number(totalSupply).toLocaleString()} total supply`,
    severity: "info",
  }).catch((err) => logger.error("Failed to record listing event:", err));
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
  const embed = createEmbed()
    .title("Token Crashed!")
    .color(EmbedColors.Error)
    .description(
      `**${name}** (\`${symbol}\`) has crashed to $0! All holdings are now worthless.`,
    )
    .field("Last Price", formatPrice(lastPrice), true)
    .footer("The token will be delisted in 48 hours")
    .timestamp();

  try {
    await Discord.Messages.send({
      channelId: Discord.Channels.general.BOT_SPAM,
      embeds: embed.build(),
    });
  } catch (err) {
    logger.error("Failed to send crash notification to Discord:", err);
  }

  createMarketEvent({
    type: "crash",
    title: `${name} (${symbol}) Crashed!`,
    description: `Last price was ${formatPrice(lastPrice)}. The token will be delisted in 48 hours.`,
    severity: "critical",
  }).catch((err) => logger.error("Failed to record crash event:", err));
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
): Promise<void> {
  const action = tradeType === "buy" ? "bought" : "sold";

  const embed = createEmbed()
    .title("Whale Alert!")
    .color(EmbedColors.Warning)
    .description(
      `**${playerName}** ${action} **${Number(amount).toLocaleString()} ${tokenSymbol}** worth **${formatPrice(totalCost)}**`,
    )
    .footer("Large trade detected")
    .timestamp();

  try {
    await Discord.Messages.send({
      channelId: Discord.Channels.general.BOT_SPAM,
      embeds: embed.build(),
    });
  } catch (err) {
    logger.error("Failed to send whale alert notification to Discord:", err);
  }
}

// ==========================================================================
// SCHEDULED REPORTS
// ==========================================================================

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
    const tokens = await Q.crypto.token
      .where({ isCrashed: false })
      .all();
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
            .map((e) => `${e.rank}. **${e.playerName}** — ${formatPrice(e.value)}`)
            .join("\n")
        : "No traders yet";

    const embed = createEmbed()
      .title("Weekly Market Report")
      .color(EmbedColors.Premium)
      .description("Here's what happened in the crypto market this week.")
      .field("Total Market Cap", formatPrice(totalMarketCap), true)
      .field("Weekly Volume", formatPrice(weeklyVolume), true)
      .field("Active Traders", `${uniqueTraders}`, true)
      .field(
        "Active Tokens",
        `${activeTokens.length} (${stableCount} stable, ${bluechipCount} blue-chip, ${memecoinCount} meme)`,
        false,
      )
      .field("Total Trades", `${weeklyTxs.length}`, true)
      .field("Top Traders (Net Worth)", leaderboardLines, false)
      .footer("Reports are generated weekly")
      .timestamp();

    await Discord.Messages.send({
      channelId: Discord.Channels.general.BOT_SPAM,
      embeds: embed.build(),
    });

    logger.info("Weekly crypto market report sent");
  } catch (err) {
    logger.error("Failed to send weekly market report:", err);
  }
}
