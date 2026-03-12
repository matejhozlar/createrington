import { createEmbed } from "../../embed-builder";
import { EmbedColors } from "../../colors";

// ==========================================================================
// NOTIFICATIONS (sent to crypto news channel)
// ==========================================================================

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

// ==========================================================================
// COMMAND RESPONSES (ephemeral replies to /crypto subcommands)
// ==========================================================================

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

export const CryptoEmbedPresets = {
  // --- Notifications ---

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

  portfolioEmpty(realizedPnl: string) {
    return createEmbed()
      .title("Crypto Portfolio")
      .color(EmbedColors.Info)
      .description("You don't hold any crypto tokens yet.")
      .field("Realized P&L", realizedPnl, true)
      .timestamp();
  },

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

  leaderboardEmpty() {
    return createEmbed()
      .title("Crypto Leaderboard")
      .color(EmbedColors.Info)
      .description("No trading activity yet.");
  },

  leaderboard(typeLabel: string, lines: string) {
    return createEmbed()
      .title(`Crypto Leaderboard — ${typeLabel}`)
      .color(EmbedColors.Premium)
      .description(lines)
      .timestamp();
  },

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

  chart(tokenName: string, symbol: string, filename: string) {
    return createEmbed()
      .title(`${tokenName} (${symbol})`)
      .color(EmbedColors.Info)
      .image(`attachment://${filename}`);
  },

  chartFallback(data: ChartFallbackData) {
    return createEmbed()
      .title(`${data.tokenName} (${data.symbol})`)
      .color(data.isPositive ? EmbedColors.Success : EmbedColors.Error)
      .field("Price", data.price, true)
      .field("24h Change", data.change24h, true)
      .field("Category", data.category, true)
      .timestamp();
  },

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

  alertRemoved(alertId: number) {
    return createEmbed()
      .title("Price Alert Removed")
      .color(EmbedColors.Success)
      .description(`Alert **#${alertId}** has been removed.`)
      .timestamp();
  },

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

  alertList(lines: string) {
    return createEmbed()
      .title("Price Alerts")
      .color(EmbedColors.Info)
      .description(lines)
      .timestamp();
  },

  alertListEmpty() {
    return createEmbed()
      .title("Price Alerts")
      .color(EmbedColors.Info)
      .description("You have no active price alerts.");
  },
};
