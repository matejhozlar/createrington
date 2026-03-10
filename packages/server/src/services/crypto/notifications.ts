import { Discord } from "@/discord/constants";
import { createEmbed, EmbedColors } from "@/discord/embeds";

function formatPrice(price: string): string {
  const num = Number(price);
  if (num === 0) return "$0.00";
  if (num < 0.01) return `$${num.toFixed(6)}`;
  if (num < 1) return `$${num.toFixed(4)}`;
  if (num < 1000) return `$${num.toFixed(2)}`;
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/**
 * Send a Discord notification when a new token is listed
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
}

/**
 * Send a Discord notification when a token crashes
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
}
