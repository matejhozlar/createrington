import { Q } from "@/db";
import {
  executeBuy,
  executeSell,
} from "@/services/crypto/trading/trade-executor";
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
import { CooldownType } from "@/discord/utils/cooldown";
import { getService, Services } from "@/services";
import config from "@/config";
import {
  AttachmentBuilder,
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
  .addSubcommand((sub) =>
    sub
      .setName("chart")
      .setDescription("View a token's price chart")
      .addStringOption((opt) =>
        opt
          .setName("symbol")
          .setDescription("Token symbol (e.g. FLF)")
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("interval")
          .setDescription("Chart time interval")
          .addChoices(
            { name: "Live", value: "tick" },
            { name: "1 Minute", value: "minute" },
            { name: "1 Hour", value: "hourly" },
            { name: "1 Day", value: "daily" },
          ),
      ),
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
      case "chart":
        await handleChart(interaction);
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

    const embed = EmbedPresets.crypto.buy({
      symbol: result.symbol,
      amount: Number(result.amount).toLocaleString(),
      price: `$${Number(result.priceAtExecution).toFixed(4)}`,
      fee: `$${result.feeAmount.toFixed(4)}`,
      totalCost: `$${result.totalCost.toFixed(2)}`,
      isIpo,
      ipoEndsAt: isIpo
        ? `<t:${Math.floor(token.ipoEndsAt!.getTime() / 1000)}:R>`
        : undefined,
    });

    await interaction.reply({ embeds: [embed.build()] });
  } else {
    const result = await executeSell(
      playerEntry.minecraftUuid,
      token,
      BigInt(amount),
    );

    const embed = EmbedPresets.crypto.sell({
      symbol: result.symbol,
      amount: Number(result.amount).toLocaleString(),
      price: `$${Number(result.priceAtExecution).toFixed(4)}`,
      fee: `$${result.feeAmount.toFixed(4)}`,
      revenue: `$${result.totalCost.toFixed(2)}`,
    });

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
    const embed = EmbedPresets.crypto.portfolioEmpty(
      formatPnl(totalRealizedPnl),
    );

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

  const embed = EmbedPresets.crypto.portfolio({
    description: lines.join("\n\n"),
    totalValue: formatPrice(totalValue),
    unrealizedPnl: formatPnl(portfolioPnl),
    realizedPnl: formatPnl(totalRealizedPnl),
    holdingCount: holdings.length,
    isProfit: portfolioPnl >= 0,
  });

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
    const embed = EmbedPresets.crypto.leaderboardEmpty();
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

  const embed = EmbedPresets.crypto.leaderboard(
    typeLabels[type],
    lines.join("\n"),
  );

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

  const embed = EmbedPresets.crypto.marketSummary({
    totalMarketCap: formatPrice(summary.totalMarketCap),
    dailyVolume: formatPrice(summary.dailyVolume),
    dailyTrades: `${summary.dailyTrades}`,
    activeTokens: `${summary.activeTokenCount} (${tokenBreakdown})`,
    uniqueTraders: `${summary.uniqueTraders}`,
  });

  const activeEvents = getActiveEventsInMemory();
  if (activeEvents.length > 0) {
    const eventLines = activeEvents.map((e) => {
      const def = EVENT_DEFINITIONS[e.type as keyof typeof EVENT_DEFINITIONS];
      const name = def?.name ?? e.type;
      const remaining = e.activeUntil
        ? ` (${Math.round((e.activeUntil.getTime() - Date.now()) / 60_000)}m remaining)`
        : "";
      return `**${name}**${e.tokenSymbol ? ` [${e.tokenSymbol}]` : ""}${remaining}`;
    });
    embed.field("Active Events", eventLines.join("\n"), false);
  }

  await interaction.reply({ embeds: [embed.build()] });
}

/**
 * Handles the `chart` subcommand
 *
 * Screenshots the crypto chart render page via PuppeteerService and replies
 * with the image as a Discord attachment. Falls back to a text embed with
 * basic price info if Puppeteer is unavailable.
 *
 * @param interaction - The incoming slash command interaction
 */
async function handleChart(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const symbol = interaction.options.getString("symbol", true).toUpperCase();
  const interval = interaction.options.getString("interval") ?? "minute";

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

  await interaction.deferReply();

  let screenshotBuffer: Buffer | null = null;
  try {
    const puppeteer = await getService(Services.PUPPETEER_SERVICE);
    const baseUrl =
      config.puppeteer.baseUrl ??
      (config.envMode.isDev
        ? "http://localhost:3000"
        : config.meta.links.website);

    const renderUrl = new URL("/render/crypto-chart", baseUrl);
    renderUrl.searchParams.set("secret", config.puppeteer.secret);
    renderUrl.searchParams.set("symbol", symbol);
    renderUrl.searchParams.set("interval", interval);

    const result = await puppeteer.screenshot({
      url: renderUrl.toString(),
      waitForSelector: "#chart-container",
      elementSelector: "#chart-container",
      settleDelay: 2000,
      timeout: 15_000,
      viewportWidth: 800,
      viewportHeight: 420,
    });

    screenshotBuffer = result.buffer;
  } catch (err) {
    logger.warn(
      "Puppeteer screenshot failed for /crypto chart, falling back to text embed:",
      err,
    );
  }

  if (screenshotBuffer) {
    const filename = `chart_${symbol}.png`;
    const attachment = new AttachmentBuilder(screenshotBuffer, {
      name: filename,
    });

    const embed = EmbedPresets.crypto.chart(token.name, symbol, filename);

    await interaction.editReply({
      embeds: [embed.build()],
      files: [attachment],
    });
  } else {
    // Text fallback
    const cryptoService = await getService(Services.CRYPTO_MARKET_SERVICE);
    const change24h = cryptoService.get24hChange(token.id, token.price);
    const changeSign = change24h >= 0 ? "+" : "";

    const embed = EmbedPresets.crypto.chartFallback({
      tokenName: token.name,
      symbol,
      price: formatPrice(token.price),
      change24h: `${changeSign}${change24h.toFixed(2)}%`,
      category: token.category.replace("_", " "),
      isPositive: change24h >= 0,
    });

    await interaction.editReply({ embeds: [embed.build()] });
  }
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

      const embed = EmbedPresets.crypto.alertCreated({
        symbol,
        direction,
        price: formatPrice(price),
        currentPrice: formatPrice(token.price),
        alertId: `#${alert.id}`,
      });

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      break;
    }

    case "remove": {
      const alertId = interaction.options.getInteger("id", true);

      await deleteAlert(playerEntry.minecraftUuid, alertId);

      const embed = EmbedPresets.crypto.alertRemoved(alertId);

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      break;
    }

    case "list": {
      const alerts = await getPlayerAlerts(playerEntry.minecraftUuid);

      if (alerts.length === 0) {
        const embed = EmbedPresets.crypto.alertListEmpty();

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

      const embed = EmbedPresets.crypto.alertList(lines.join("\n\n"));

      await interaction.reply({
        embeds: [embed.build()],
        flags: MessageFlags.Ephemeral,
      });
      break;
    }
  }
}
