import { Q } from "@/db";
import { executeBuy, executeSell } from "@/services/crypto/trading/trade-executor";
import { getLeaderboard } from "@/services/crypto/analytics/leaderboard";
import {
  getPlayerAlerts,
  createAlert,
  deleteAlert,
} from "@/services/crypto/alerts/alert-manager";
import { getMarketSummary } from "@/services/crypto/notifications";
import { getActiveEventsInMemory } from "@/services/crypto/events/event-engine";
import { EVENT_DEFINITIONS } from "@/services/crypto/events/event-definitions";
import { EmbedPresets } from "@/discord/embeds";
import { EmbedColors } from "@/discord/embeds";
import { createEmbed } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

/** Formats a numeric price into a human-readable dollar string with adaptive precision */
function formatPrice(price: string | number): string {
  const num = Number(price);
  if (num === 0) return "$0.00";
  if (num < 0.01) return `$${num.toFixed(6)}`;
  if (num < 1) return `$${num.toFixed(4)}`;
  if (num < 1000) return `$${num.toFixed(2)}`;
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/** Formats a P&L value as a signed dollar string (e.g. `+$12.34` or `-$5.00`) */
function formatPnl(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${formatPrice(Math.abs(value))}`;
}

export const data = new SlashCommandBuilder()
  .setName("crypto")
  .setDescription("Trade crypto tokens")
  .addSubcommand((sub) =>
    sub
      .setName("buy")
      .setDescription("Buy crypto tokens")
      .addStringOption((opt) =>
        opt
          .setName("symbol")
          .setDescription("Token symbol (e.g. FLF)")
          .setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName("amount")
          .setDescription("Number of tokens to buy")
          .setRequired(true)
          .setMinValue(1),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("sell")
      .setDescription("Sell crypto tokens")
      .addStringOption((opt) =>
        opt
          .setName("symbol")
          .setDescription("Token symbol (e.g. FLF)")
          .setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName("amount")
          .setDescription("Number of tokens to sell")
          .setRequired(true)
          .setMinValue(1),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName("portfolio").setDescription("View your crypto portfolio"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("leaderboard")
      .setDescription("View the crypto trading leaderboard")
      .addStringOption((opt) =>
        opt
          .setName("type")
          .setDescription("Leaderboard ranking type")
          .addChoices(
            { name: "Net Worth", value: "networth" },
            { name: "Realized P&L", value: "pnl" },
            { name: "Trade Volume", value: "volume" },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName("market").setDescription("View market summary and stats"),
  )
  .addSubcommandGroup((group) =>
    group
      .setName("alert")
      .setDescription("Manage price alerts")
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Create a price alert")
          .addStringOption((opt) =>
            opt
              .setName("symbol")
              .setDescription("Token symbol (e.g. FLF)")
              .setRequired(true),
          )
          .addNumberOption((opt) =>
            opt
              .setName("price")
              .setDescription("Target price to trigger the alert")
              .setRequired(true)
              .setMinValue(0.000001),
          )
          .addStringOption((opt) =>
            opt
              .setName("direction")
              .setDescription("Alert when price goes above or below target")
              .setRequired(true)
              .addChoices(
                { name: "Above", value: "above" },
                { name: "Below", value: "below" },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove a price alert")
          .addIntegerOption((opt) =>
            opt
              .setName("id")
              .setDescription("Alert ID to remove")
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("list").setDescription("List your active price alerts"),
      ),
  );

export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before trading again!",
};

/**
 * Handles the `/crypto` slash command
 *
 * Routes to the appropriate subcommand handler based on the selected subcommand
 * or subcommand group. All handler errors are caught and replied to the user
 * as an ephemeral error embed.
 *
 * @param interaction - The incoming slash command interaction
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const subcommandGroup = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();
  const discordId = interaction.user.id;

  try {
    if (subcommandGroup === "alert") {
      await handleAlert(interaction, subcommand, discordId);
      return;
    }

    switch (subcommand) {
      case "buy":
      case "sell":
        await handleTrade(interaction, subcommand, discordId);
        break;
      case "portfolio":
        await handlePortfolio(interaction, discordId);
        break;
      case "leaderboard":
        await handleLeaderboard(interaction);
        break;
      case "market":
        await handleMarket(interaction);
        break;
    }
  } catch (error) {
    logger.error(`/crypto ${subcommandGroup ?? subcommand} failed:`, error);

    const message =
      error instanceof Error ? error.message : "Something went wrong.";
    const embed = EmbedPresets.error("Trade Failed", message);
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handles the `buy` and `sell` subcommands
 *
 * Validates that the invoking player is registered and that the requested token
 * symbol exists, then delegates to `executeBuy` or `executeSell` and replies
 * with an embed summarising the executed price, fee, and total cost/revenue.
 * For buy orders during an active IPO window, the response embed uses an
 * IPO-specific title and includes a countdown field showing when trading opens.
 *
 * @param interaction - The incoming slash command interaction
 * @param subcommand - Either `"buy"` or `"sell"`
 * @param discordId - Discord user ID of the invoking player
 */
async function handleTrade(
  interaction: ChatInputCommandInteraction,
  subcommand: string,
  discordId: string,
): Promise<void> {
  const symbol = interaction.options.getString("symbol", true).toUpperCase();
  const amount = interaction.options.getInteger("amount", true);

  const playerEntry = await Q.player.find({ discordId });

  if (!playerEntry) {
    const embed = EmbedPresets.error(
      "Not Registered",
      "You must be registered to trade crypto. Use `/register` to get started.",
    );
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const token = await Q.crypto.token.find({ symbol });

  if (!token) {
    const embed = EmbedPresets.error(
      "Token Not Found",
      `No token with symbol **${symbol}** exists.`,
    );
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (subcommand === "buy") {
    const isIpo = !!token.ipoEndsAt && token.ipoEndsAt > new Date();

    const result = await executeBuy(
      playerEntry.minecraftUuid,
      token,
      BigInt(amount),
    );

    const embed = createEmbed()
      .title(isIpo ? "IPO Buy" : "Crypto Buy")
      .color(EmbedColors.Success)
      .description(
        `Bought **${Number(result.amount).toLocaleString()} ${result.symbol}**${isIpo ? " (IPO)" : ""}`,
      )
      .field("Price", `$${Number(result.priceAtExecution).toFixed(4)}`, true)
      .field("Fee", `$${result.feeAmount.toFixed(4)}`, true)
      .field("Total Cost", `$${result.totalCost.toFixed(2)}`, true);

    if (isIpo) {
      embed.field("IPO Ends", `<t:${Math.floor(token.ipoEndsAt!.getTime() / 1000)}:R>`, true);
    }

    embed.timestamp();

    await interaction.reply({ embeds: [embed.build()] });
  } else {
    const result = await executeSell(
      playerEntry.minecraftUuid,
      token,
      BigInt(amount),
    );

    const embed = createEmbed()
      .title("Crypto Sell")
      .color(EmbedColors.Success)
      .description(
        `Sold **${Number(result.amount).toLocaleString()} ${result.symbol}**`,
      )
      .field("Price", `$${Number(result.priceAtExecution).toFixed(4)}`, true)
      .field("Fee", `$${result.feeAmount.toFixed(4)}`, true)
      .field("Revenue", `$${result.totalCost.toFixed(2)}`, true)
      .timestamp();

    await interaction.reply({ embeds: [embed.build()] });
  }
}

/**
 * Handles the `portfolio` subcommand
 *
 * Displays all current holdings with per-token unrealized P&L and a summary
 * of total portfolio value and cumulative realized P&L from past sells.
 *
 * @param interaction - The incoming slash command interaction
 * @param discordId - Discord user ID of the invoking player
 */
async function handlePortfolio(
  interaction: ChatInputCommandInteraction,
  discordId: string,
): Promise<void> {
  const playerEntry = await Q.player.find({ discordId });

  if (!playerEntry) {
    const embed = EmbedPresets.error(
      "Not Registered",
      "You must be registered to view your portfolio. Use `/register` to get started.",
    );
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const holdings = await Q.crypto.holding
    .where({ playerMinecraftUuid: playerEntry.minecraftUuid })
    .all();

  // Calculate cumulative realized P&L
  const allSells = await Q.crypto.transaction
    .where({
      playerMinecraftUuid: playerEntry.minecraftUuid,
      type: "sell",
    })
    .all();
  const totalRealizedPnl = allSells.reduce(
    (sum, tx) => sum + (tx.realizedPnl ? Number(tx.realizedPnl) : 0),
    0,
  );

  if (holdings.length === 0) {
    const embed = createEmbed()
      .title("Crypto Portfolio")
      .color(EmbedColors.Info)
      .description("You don't hold any crypto tokens yet.")
      .field("Realized P&L", formatPnl(totalRealizedPnl), true)
      .footer("Use /crypto buy to start trading")
      .timestamp();

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const tokens = await Q.crypto.token.where({}).all();
  const tokenMap = new Map(tokens.map((t) => [t.id, t]));

  let totalValue = 0;
  let totalInvested = 0;
  const lines: string[] = [];

  for (const h of holdings) {
    const token = tokenMap.get(h.tokenId);
    if (!token) continue;

    const currentPrice = Number(token.price);
    const amount = Number(h.amount);
    const costBasis = Number(h.totalCostBasis);
    const currentValue = currentPrice * amount;
    const unrealizedPnl = currentValue - costBasis;
    const pnlPercent = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;
    const pnlSign = unrealizedPnl >= 0 ? "+" : "";

    totalValue += currentValue;
    totalInvested += costBasis;

    lines.push(
      `**${token.symbol}** — ${amount.toLocaleString()} @ ${formatPrice(currentPrice)}\n` +
        `Value: ${formatPrice(currentValue)} (${pnlSign}${pnlPercent.toFixed(1)}%)`,
    );
  }

  const portfolioPnl = totalValue - totalInvested;

  const embed = createEmbed()
    .title("Crypto Portfolio")
    .color(portfolioPnl >= 0 ? EmbedColors.Success : EmbedColors.Error)
    .description(lines.join("\n\n"))
    .field("Total Value", formatPrice(totalValue), true)
    .field("Unrealized P&L", formatPnl(portfolioPnl), true)
    .field("Realized P&L", formatPnl(totalRealizedPnl), true)
    .footer(`${holdings.length} token${holdings.length === 1 ? "" : "s"} held`)
    .timestamp();

  await interaction.reply({
    embeds: [embed.build()],
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Handles the `leaderboard` subcommand
 *
 * Fetches the top 10 players ranked by the selected metric (net worth, realized
 * P&L, or trade volume) and renders them as a numbered embed with medal prefixes
 * for the top three positions.
 *
 * @param interaction - The incoming slash command interaction
 */
async function handleLeaderboard(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const type =
    (interaction.options.getString("type") as
      | "networth"
      | "pnl"
      | "volume"
      | null) ?? "networth";

  const entries = await getLeaderboard(type, 10);

  if (entries.length === 0) {
    const embed = createEmbed()
      .title("Crypto Leaderboard")
      .color(EmbedColors.Info)
      .description("No trading activity yet.");

    await interaction.reply({ embeds: [embed.build()] });
    return;
  }

  const typeLabels: Record<string, string> = {
    networth: "Net Worth",
    pnl: "Realized P&L",
    volume: "Trade Volume",
  };

  const medals = ["🥇", "🥈", "🥉"];
  const lines = entries.map((e) => {
    const prefix = e.rank <= 3 ? medals[e.rank - 1] : `**${e.rank}.**`;
    return `${prefix} **${e.playerName}** — ${formatPrice(e.value)}`;
  });

  const embed = createEmbed()
    .title(`Crypto Leaderboard — ${typeLabels[type]}`)
    .color(EmbedColors.Premium)
    .description(lines.join("\n"))
    .footer("Updated in real-time")
    .timestamp();

  await interaction.reply({ embeds: [embed.build()] });
}

/**
 * Handles the `market` subcommand
 *
 * Displays a market summary with total market cap, 24h volume, active tokens,
 * active traders, and any ongoing market events.
 *
 * @param interaction - The incoming slash command interaction
 */
async function handleMarket(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const summary = await getMarketSummary();

  const tokenBreakdown = [
    summary.stableCount > 0 ? `${summary.stableCount} stable` : null,
    summary.bluechipCount > 0 ? `${summary.bluechipCount} blue-chip` : null,
    summary.memecoinCount > 0 ? `${summary.memecoinCount} meme` : null,
    summary.seasonalCount > 0 ? `${summary.seasonalCount} seasonal` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const embed = createEmbed()
    .title("Crypto Market Summary")
    .color(EmbedColors.Premium)
    .field("Total Market Cap", formatPrice(summary.totalMarketCap), true)
    .field("24h Volume", formatPrice(summary.dailyVolume), true)
    .field("24h Trades", `${summary.dailyTrades}`, true)
    .field(
      "Active Tokens",
      `${summary.activeTokenCount} (${tokenBreakdown})`,
      false,
    )
    .field("Active Traders (24h)", `${summary.uniqueTraders}`, true);

  const activeEvents = getActiveEventsInMemory();
  if (activeEvents.length > 0) {
    const eventLines = activeEvents.map((e) => {
      const def =
        EVENT_DEFINITIONS[e.type as keyof typeof EVENT_DEFINITIONS];
      const name = def?.name ?? e.type;
      const remaining = e.activeUntil
        ? ` (${Math.round((e.activeUntil.getTime() - Date.now()) / 60_000)}m remaining)`
        : "";
      return `**${name}**${e.tokenSymbol ? ` [${e.tokenSymbol}]` : ""}${remaining}`;
    });
    embed.field("Active Events", eventLines.join("\n"), false);
  }

  embed.footer("Use /crypto buy or /crypto sell to trade").timestamp();

  await interaction.reply({ embeds: [embed.build()] });
}

/**
 * Handles the `alert` subcommand group (`add`, `remove`, `list`)
 *
 * Validates that the invoking player is registered, then branches on the
 * subcommand: `add` creates a new price alert for a token/direction pair,
 * `remove` deletes an alert by ID, and `list` renders all active alerts with
 * their current token prices. All replies are ephemeral.
 *
 * @param interaction - The incoming slash command interaction
 * @param subcommand - The selected alert subcommand
 * @param discordId - Discord user ID of the invoking player
 */
async function handleAlert(
  interaction: ChatInputCommandInteraction,
  subcommand: string,
  discordId: string,
): Promise<void> {
  const playerEntry = await Q.player.find({ discordId });

  if (!playerEntry) {
    const embed = EmbedPresets.error(
      "Not Registered",
      "You must be registered to manage alerts. Use `/register` to get started.",
    );
    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  switch (subcommand) {
    case "add": {
      const symbol = interaction.options
        .getString("symbol", true)
        .toUpperCase();
      const price = interaction.options.getNumber("price", true);
      const direction = interaction.options.getString("direction", true) as
        | "above"
        | "below";

      const token = await Q.crypto.token.find({ symbol });

      if (!token) {
        const embed = EmbedPresets.error(
          "Token Not Found",
          `No token with symbol **${symbol}** exists.`,
        );
        await interaction.reply({
          embeds: [embed.build()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const alert = await createAlert(
        playerEntry.minecraftUuid,
        token.id,
        price.toString(),
        direction,
      );

      const embed = createEmbed()
        .title("Price Alert Created")
        .color(EmbedColors.Success)
        .description(
          `Alert when **${symbol}** goes **${direction}** ${formatPrice(price)}`,
        )
        .field("Current Price", formatPrice(token.price), true)
        .field("Alert ID", `#${alert.id}`, true)
        .timestamp();

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      break;
    }

    case "remove": {
      const alertId = interaction.options.getInteger("id", true);

      await deleteAlert(playerEntry.minecraftUuid, alertId);

      const embed = createEmbed()
        .title("Price Alert Removed")
        .color(EmbedColors.Success)
        .description(`Alert **#${alertId}** has been removed.`)
        .timestamp();

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      break;
    }

    case "list": {
      const alerts = await getPlayerAlerts(playerEntry.minecraftUuid);

      if (alerts.length === 0) {
        const embed = createEmbed()
          .title("Price Alerts")
          .color(EmbedColors.Info)
          .description("You have no active price alerts.")
          .footer("Use /crypto alert add to create one");

        await interaction.reply({
          embeds: [embed.build()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const tokens = await Q.crypto.token.where({}).all();
      const tokenMap = new Map(tokens.map((t) => [t.id, t]));

      const lines = alerts.map((a) => {
        const token = tokenMap.get(a.tokenId);
        const symbol = token?.symbol ?? "???";
        const currentPrice = token ? formatPrice(token.price) : "N/A";
        return (
          `**#${a.id}** — **${symbol}** ${a.direction} ${formatPrice(a.targetPrice)}\n` +
          `Current: ${currentPrice}`
        );
      });

      const embed = createEmbed()
        .title("Price Alerts")
        .color(EmbedColors.Info)
        .description(lines.join("\n\n"))
        .footer(
          `${alerts.length} active alert${alerts.length === 1 ? "" : "s"}`,
        )
        .timestamp();

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      break;
    }
  }
}
