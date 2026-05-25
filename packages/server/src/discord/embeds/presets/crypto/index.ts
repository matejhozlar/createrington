import { createEmbed } from "../../embed-builder";
import { EmbedColors } from "../../colors";

export interface NewListingData {
  name: string;
  symbol: string;
  price: string;
  totalSupply: string;
}

export interface IpoAnnouncementData {
  name: string;
  symbol: string;
  ipoPrice: string;
  totalSupply: string;
  maxPerPlayer: string;
  ipoEndsAt: string;
  duration: string;
}

export interface IpoResultData {
  name: string;
  symbol: string;
  ipoPrice: string;
  tokensSold: string;
  totalRaised: string;
  participants: string;
}

export interface WeeklyReportData {
  totalMarketCap: string;
  weeklyVolume: string;
  activeTraders: string;
  activeTokens: string;
  totalTrades: string;
  topTraders: string;
}

export interface BuyData {
  symbol: string;
  amount: string;
  price: string;
  fee: string;
  totalCost: string;
  isIpo: boolean;
  ipoEndsAt?: string;
}

export interface SellData {
  symbol: string;
  amount: string;
  price: string;
  fee: string;
  revenue: string;
}

export interface PortfolioData {
  description: string;
  totalValue: string;
  unrealizedPnl: string;
  realizedPnl: string;
  holdingCount: number;
  isProfit: boolean;
}

export interface MarketSummaryData {
  totalMarketCap: string;
  dailyVolume: string;
  dailyTrades: string;
  activeTokens: string;
  uniqueTraders: string;
}

export interface ChartFallbackData {
  tokenName: string;
  symbol: string;
  price: string;
  change24h: string;
  category: string;
  isPositive: boolean;
}

export interface AlertCreatedData {
  symbol: string;
  direction: string;
  price: string;
  currentPrice: string;
  alertId: string;
}

/** Embed presets for crypto system notifications and command responses */
export const CryptoEmbedPresets = {
  // --- Notifications ---

  /** Announces a newly listed token available for trading */
  newListing(data: NewListingData) {
    return createEmbed()
      .title("New Token Listed!")
      .color(EmbedColors.Success)
      .description(
        `**${data.name}** (\`${data.symbol}\`) is now available for trading!`,
      )
      .field("Starting Price", data.price, true)
      .field("Total Supply", data.totalSupply, true)
      .timestamp();
  },

  /** Announces an upcoming IPO with price, supply, and timing details */
  ipoAnnouncement(data: IpoAnnouncementData) {
    return createEmbed()
      .title("IPO Launch!")
      .color(EmbedColors.Premium)
      .description(
        `**${data.name}** (\`${data.symbol}\`) is launching via IPO!\nGet in at the fixed price before open trading begins.`,
      )
      .field("IPO Price", data.ipoPrice, true)
      .field("Total Supply", data.totalSupply, true)
      .field("Max Per Player", data.maxPerPlayer, true)
      .field("IPO Ends", data.ipoEndsAt, true)
      .field("Duration", data.duration, true)
      .timestamp();
  },

  /** Announces completion of an IPO with final sale stats */
  ipoResult(data: IpoResultData) {
    return createEmbed()
      .title("IPO Complete!")
      .color(EmbedColors.Success)
      .description(
        `**${data.name}** (\`${data.symbol}\`) IPO has ended. The token is now open for trading!`,
      )
      .field("IPO Price", data.ipoPrice, true)
      .field("Tokens Sold", data.tokensSold, true)
      .field("Total Raised", data.totalRaised, true)
      .field("Participants", data.participants, true)
      .timestamp();
  },

  /** Notifies that a token has crashed to zero and will be delisted */
  crash(name: string, symbol: string, lastPrice: string) {
    return createEmbed()
      .title("Token Crashed!")
      .color(EmbedColors.Error)
      .description(
        `**${name}** (\`${symbol}\`) has crashed to $0! All holdings are now worthless.\nThe token will be delisted in 48 hours.`,
      )
      .field("Last Price", lastPrice, true)
      .timestamp();
  },

  /** Alerts when a player makes a large trade that qualifies as whale activity */
  whaleAlert(
    playerName: string,
    action: string,
    amount: string,
    tokenSymbol: string,
    totalCost: string,
  ) {
    return createEmbed()
      .title("Whale Alert!")
      .color(EmbedColors.Warning)
      .description(
        `**${playerName}** ${action} **${amount} ${tokenSymbol}** worth **${totalCost}**`,
      )
      .timestamp();
  },

  /** Broadcasts a named market event with severity-mapped color */
  marketEvent(
    name: string,
    description: string,
    severity: "info" | "warning" | "critical",
  ) {
    const colorMap: Record<string, number> = {
      info: EmbedColors.Info,
      warning: EmbedColors.Warning,
      critical: EmbedColors.Error,
    };

    return createEmbed()
      .title(`Market Event: ${name}`)
      .color(colorMap[severity] ?? EmbedColors.Info)
      .description(description)
      .timestamp();
  },

  /** Posts the weekly market summary report with key trading metrics */
  weeklyReport(data: WeeklyReportData) {
    return createEmbed()
      .title("Weekly Market Report")
      .color(EmbedColors.Premium)
      .description("Here's what happened in the crypto market this week.")
      .field("Total Market Cap", data.totalMarketCap, true)
      .field("Weekly Volume", data.weeklyVolume, true)
      .field("Active Traders", data.activeTraders, true)
      .field("Active Tokens", data.activeTokens, false)
      .field("Total Trades", data.totalTrades, true)
      .field("Top Traders (Net Worth)", data.topTraders, false)
      .timestamp();
  },

  // --- Command Responses ---

  /** Confirms a successful token purchase or IPO entry */
  buy(data: BuyData) {
    const embed = createEmbed()
      .title(data.isIpo ? "IPO Buy" : "Crypto Buy")
      .color(EmbedColors.Success)
      .description(
        `Bought **${data.amount} ${data.symbol}**${data.isIpo ? " (IPO)" : ""}`,
      )
      .field("Price", data.price, true)
      .field("Fee", data.fee, true)
      .field("Total Cost", data.totalCost, true);

    if (data.isIpo && data.ipoEndsAt) {
      embed.field("IPO Ends", data.ipoEndsAt, true);
    }

    return embed.timestamp();
  },

  /** Confirms a successful token sale with price, fee, and revenue */
  sell(data: SellData) {
    return createEmbed()
      .title("Crypto Sell")
      .color(EmbedColors.Success)
      .description(`Sold **${data.amount} ${data.symbol}**`)
      .field("Price", data.price, true)
      .field("Fee", data.fee, true)
      .field("Revenue", data.revenue, true)
      .timestamp();
  },

  /** Shown when a player's portfolio has no current holdings */
  portfolioEmpty(realizedPnl: string) {
    return createEmbed()
      .title("Crypto Portfolio")
      .color(EmbedColors.Info)
      .description("You don't hold any crypto tokens yet.")
      .field("Realized P&L", realizedPnl, true)
      .timestamp();
  },

  /** Displays a player's active holdings with total value and P&L summary */
  portfolio(data: PortfolioData) {
    return createEmbed()
      .title("Crypto Portfolio")
      .color(data.isProfit ? EmbedColors.Success : EmbedColors.Error)
      .description(data.description)
      .field("Total Value", data.totalValue, true)
      .field("Unrealized P&L", data.unrealizedPnl, true)
      .field("Realized P&L", data.realizedPnl, true)
      .timestamp();
  },

  /** Shown when the crypto leaderboard has no entries yet */
  leaderboardEmpty() {
    return createEmbed()
      .title("Crypto Leaderboard")
      .color(EmbedColors.Info)
      .description("No trading activity yet.");
  },

  /** Displays a ranked crypto leaderboard for the specified metric */
  leaderboard(typeLabel: string, lines: string) {
    return createEmbed()
      .title(`Crypto Leaderboard - ${typeLabel}`)
      .color(EmbedColors.Premium)
      .description(lines)
      .timestamp();
  },

  /** Displays an overview of current market activity (cap, volume, tokens, traders) */
  marketSummary(data: MarketSummaryData) {
    return createEmbed()
      .title("Crypto Market Summary")
      .color(EmbedColors.Premium)
      .field("Total Market Cap", data.totalMarketCap, true)
      .field("24h Volume", data.dailyVolume, true)
      .field("24h Trades", data.dailyTrades, true)
      .field("Active Tokens", data.activeTokens, false)
      .field("Active Traders (24h)", data.uniqueTraders, true)
      .timestamp();
  },

  /** Displays a token price chart image as a Discord attachment embed */
  chart(tokenName: string, symbol: string, filename: string) {
    return createEmbed()
      .title(`${tokenName} (${symbol})`)
      .color(EmbedColors.Info)
      .image(`attachment://${filename}`);
  },

  /** Text-only fallback shown when the chart screenshot is unavailable */
  chartFallback(data: ChartFallbackData) {
    return createEmbed()
      .title(`${data.tokenName} (${data.symbol})`)
      .color(data.isPositive ? EmbedColors.Success : EmbedColors.Error)
      .field("Price", data.price, true)
      .field("24h Change", data.change24h, true)
      .field("Category", data.category, true)
      .timestamp();
  },

  /** Confirms a new price alert was created with direction, target, and current price */
  alertCreated(data: AlertCreatedData) {
    return createEmbed()
      .title("Price Alert Created")
      .color(EmbedColors.Success)
      .description(
        `Alert when **${data.symbol}** goes **${data.direction}** ${data.price}`,
      )
      .field("Current Price", data.currentPrice, true)
      .field("Alert ID", data.alertId, true)
      .timestamp();
  },

  /** Confirms a price alert was successfully removed by ID */
  alertRemoved(alertId: number) {
    return createEmbed()
      .title("Price Alert Removed")
      .color(EmbedColors.Success)
      .description(`Alert **#${alertId}** has been removed.`)
      .timestamp();
  },

  /** Notifies a player that their price alert condition has been met */
  priceAlertTriggered(data: {
    symbol: string;
    direction: string;
    targetPrice: string;
    currentPrice: string;
  }) {
    return createEmbed()
      .title("Price Alert Triggered!")
      .color(EmbedColors.Warning)
      .description(
        `**${data.symbol}** went **${data.direction}** your target of ${data.targetPrice}`,
      )
      .field("Current Price", data.currentPrice, true)
      .field("Target", `${data.direction} ${data.targetPrice}`, true)
      .timestamp();
  },

  /** Displays a player's active price alerts with current token prices */
  alertList(lines: string) {
    return createEmbed()
      .title("Price Alerts")
      .color(EmbedColors.Info)
      .description(lines)
      .timestamp();
  },

  /** Shown when a player has no active price alerts */
  alertListEmpty() {
    return createEmbed()
      .title("Price Alerts")
      .color(EmbedColors.Info)
      .description("You have no active price alerts.");
  },
};
