import { Discord } from "@/discord/constants";
import { createEmbed, EmbedColors } from "@/discord/embeds";
import { createMarketEvent } from "./events/news-feed";

/**
 * Formats a price string with appropriate decimal precision based on magnitude.
 *
 * @param price - Decimal price string to format
 * @returns Human-readable price string with a leading "$" sign
 */
function formatPrice(price: string): string {
  const num = Number(price);
  if (num === 0) return "$0.00";
  if (num < 0.01) return `$${num.toFixed(6)}`;
  if (num < 1) return `$${num.toFixed(4)}`;
  if (num < 1000) return `$${num.toFixed(2)}`;
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/**
 * Sends a Discord embed to the bot-spam channel announcing a newly listed token,
 * and records a "new_listing" event in the market news feed.
 *
 * @param name - Display name of the token (e.g. "DogeMoon")
 * @param symbol - Ticker symbol of the token (e.g. "DGMN")
 * @param price - Starting price as a decimal string
 * @param totalSupply - Total supply as a numeric string
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

  // Record as news feed event
  createMarketEvent({
    type: "new_listing",
    title: `New Token: ${name} (${symbol})`,
    description: `Starting at ${formatPrice(price)} with ${Number(totalSupply).toLocaleString()} total supply`,
    severity: "info",
  }).catch((err) => logger.error("Failed to record listing event:", err));
}

/**
 * Sends a Discord embed to the bot-spam channel announcing a token crash,
 * and records a "crash" event in the market news feed.
 *
 * @param name - Display name of the crashed token
 * @param symbol - Ticker symbol of the crashed token
 * @param lastPrice - The price at the time of crash as a decimal string
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

  // Record as news feed event
  createMarketEvent({
    type: "crash",
    title: `${name} (${symbol}) Crashed!`,
    description: `Last price was ${formatPrice(lastPrice)}. The token will be delisted in 48 hours.`,
    severity: "critical",
  }).catch((err) => logger.error("Failed to record crash event:", err));
}
