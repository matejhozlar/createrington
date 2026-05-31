/**
 * AI Article Generator for market events
 *
 * Generates Bloomberg/WSJ-style news articles for crypto market events using an
 * AI language model grounded in live market data:
 * - Builds a rich market context snapshot (prices, volume, breadth, leaderboard)
 * - Fetches token-scoped data (recent trades, top holders, pending orders, price history)
 * - Resolves Minecraft UUIDs to player display names for realistic reporting
 * - Calls the AI service with a financial journalist system prompt
 * - Persists the generated article text and structured sidebar data back to the event record
 *
 * NOTE: Article generation is always fire-and-forget. Errors are logged but never
 * propagate: the market event is already recorded before generation is attempted.
 */

import { Q } from "@/db";
import config from "@/config";
import { toUnixSeconds } from "@/utils/format";
import { getService } from "@/services";
import { Services } from "@/services/container";
import { getLeaderboard } from "../analytics/leaderboard";
import type { CryptoMarketService } from "../crypto-market.service";

// Serial queue: only one article generates at a time to avoid parallel
// OpenAI calls and redundant DB snapshots when events burst

type QueuedArticle = {
  eventId: number;
  title: string;
  description: string | null;
  severity: string;
  metadata: Record<string, unknown> | null;
};

const articleQueue: QueuedArticle[] = [];
let processing = false;

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  while (articleQueue.length > 0) {
    const job = articleQueue.shift()!;
    try {
      await generateArticleForEvent(
        job.eventId,
        job.title,
        job.description,
        job.severity,
        job.metadata,
      );
    } catch (error) {
      logger.warn(
        `Failed to generate article for event ${job.eventId}: ${error}`,
      );
    }
  }

  processing = false;
}

interface ArticleTopHolder {
  name: string;
  amount: string;
  costBasis: string;
}

interface ArticleRecentTrade {
  name: string;
  type: string;
  amount: string;
  price: string;
  total: string;
  timeAgo: string;
}

interface ArticleLeaderboardEntry {
  rank: number;
  name: string;
  value: string;
}

interface ArticlePriceCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ArticleData {
  topHolders: ArticleTopHolder[];
  recentTrades: ArticleRecentTrade[];
  marketBreadth: { up: number; down: number; flat: number };
  leaderboardTop3: ArticleLeaderboardEntry[];
  tokenVolume24h: string;
  totalVolume24h: string;
  priceHistory: ArticlePriceCandle[];
}

const SYSTEM_PROMPT = `You are a seasoned financial journalist writing for the Createrington Exchange, a fictional cryptocurrency market on a Minecraft server powered by the Create mod.

Your articles read like real Bloomberg or WSJ coverage, but with a fun Minecraft twist. Players trade memecoins, speculate on volatile tokens, and react to market events, all within a blocky economy of redstone, contraptions, and cobblestone fortunes.

Style guide:
- Write 4-7 paragraphs of varying length (1-4 sentences each), avoid uniform paragraph sizes
- Lead with the most impactful fact, a player's notable trade, or a surprising market statistic
- When REAL PLAYER TRADES data is provided, use those actual player names as traders in the article: they are real exchange participants, not fictional characters. Dedicate at least one paragraph to their trading activity
- When TOP HOLDERS data is provided, mention the largest positions and who controls them
- Also include fictional analyst commentary with Minecraft-themed names (e.g. "RedstoneRick", "CopperCog", "PistonPete"), but keep the balance: real player data should dominate when available
- Vary article structure: sometimes lead with a player's bold trade, sometimes with market stats, sometimes with historical context from recent events
- Reference recent events for narrative continuity when previous event data is provided
- Include specific numbers from the data provided (prices, percentages, volumes), never invent figures
- Reference Minecraft/Create mod context naturally (redstone circuits, mechanical crafters, server builds, andesite alloy, etc.)
- Vary tone by severity: "info" events are optimistic/neutral, "warning" events are cautious, "critical" events are urgent
- Do not use markdown formatting: plain text with paragraph breaks only
- Do not include a headline or title: it is provided separately
- Only reference tokens from the provided token list: never invent token names or symbols`;

type PlayerNameMap = Map<string, string>;

/**
 * Builds a UUID-to-username lookup map for all registered players.
 *
 * @private
 * @returns Map keyed by Minecraft UUID with display username as value
 */
async function buildPlayerNameMap(): Promise<PlayerNameMap> {
  const players = await Q.player.getAll();
  const map: PlayerNameMap = new Map();
  for (const p of players) {
    map.set(p.minecraftUuid, p.minecraftUsername);
  }
  return map;
}

/**
 * Resolves a Minecraft UUID to a display username, falling back to "Unknown Trader".
 *
 * @private
 * @param playerNameMap - Pre-built UUID-to-username map
 * @param minecraftUuid - The UUID to resolve
 * @returns The player's username, or "Unknown Trader" if not found
 */
function resolvePlayerName(
  playerNameMap: PlayerNameMap,
  minecraftUuid: string,
): string {
  return playerNameMap.get(minecraftUuid) ?? "Unknown Trader";
}

/**
 * Builds a formatted 24-hour volume section for the AI prompt.
 * Returns an empty string when total volume is zero.
 *
 * @private
 * @param cryptoService - Service used to retrieve per-token and total volume
 * @param sortedTokens - Tokens sorted by market cap; top 5 are included in the output
 * @returns Formatted volume text block, or an empty string if no volume exists
 */
function buildVolumeSection(
  cryptoService: CryptoMarketService,
  sortedTokens: { id: number; symbol: string }[],
): string {
  const totalVolume = cryptoService.getTotalVolume24h();
  if (totalVolume === 0n) return "";

  const lines = [
    ``,
    `=== 24H VOLUME ===`,
    `Total exchange volume (24h): ${totalVolume.toLocaleString()} tokens traded`,
  ];

  const top5 = sortedTokens.slice(0, 5);
  for (const t of top5) {
    const vol = cryptoService.getTokenVolume24h(t.id);
    if (vol > 0n) {
      lines.push(`- ${t.symbol}: ${vol.toLocaleString()} tokens`);
    }
  }

  return lines.join("\n");
}

/**
 * Counts tokens by 24-hour direction (up / down / flat) and builds a breadth summary.
 * A token is "up" if its 24h change exceeds +0.5%, "down" below -0.5%, "flat" otherwise.
 *
 * @private
 * @param tokens - Token list with pre-calculated 24h change values
 * @returns Formatted text block and the raw breadth counts for structured article data
 */
function buildMarketBreadthSection(tokens: { change24h: number }[]): {
  text: string;
  breadth: { up: number; down: number; flat: number };
} {
  let up = 0;
  let down = 0;
  let flat = 0;
  for (const t of tokens) {
    if (t.change24h > 0.5) up++;
    else if (t.change24h < -0.5) down++;
    else flat++;
  }

  const text = [
    ``,
    `=== MARKET BREADTH ===`,
    `Tokens up: ${up} | Tokens down: ${down} | Flat: ${flat}`,
  ].join("\n");

  return { text, breadth: { up, down, flat } };
}

/**
 * Fetches the 10 most recent trades for a token and formats them for the AI prompt.
 *
 * @private
 * @param tokenId - ID of the focus token
 * @param playerNameMap - Pre-built UUID-to-username map for name resolution
 * @returns Formatted text block and structured trade records for article sidebar data
 */
async function buildRecentTradesSection(
  tokenId: number,
  playerNameMap: PlayerNameMap,
): Promise<{ text: string; trades: ArticleRecentTrade[] }> {
  const transactions = await Q.crypto.transaction
    .where({ tokenId })
    .orderBy("createdAt", "desc")
    .limit(10)
    .all();

  if (transactions.length === 0) return { text: "", trades: [] };

  const lines = [``, `=== RECENT TRADES (focus token) ===`];
  const trades: ArticleRecentTrade[] = [];

  for (const tx of transactions) {
    const name = resolvePlayerName(playerNameMap, tx.playerMinecraftUuid);
    const amount = tx.amount < 0n ? -tx.amount : tx.amount;
    const ago = relativeTimeAgo(tx.createdAt);
    lines.push(
      `- ${name} ${tx.type} ${amount.toLocaleString()} tokens @ $${Number(tx.priceAtExecution).toFixed(4)} (total: $${Number(tx.totalCost).toFixed(2)}) - ${ago}`,
    );
    trades.push({
      name,
      type: tx.type,
      amount: amount.toString(),
      price: tx.priceAtExecution,
      total: tx.totalCost,
      timeAgo: ago,
    });
  }

  return { text: lines.join("\n"), trades };
}

/**
 * Fetches the top 5 holders of a token by amount and formats them for the AI prompt.
 *
 * @private
 * @param tokenId - ID of the focus token
 * @param playerNameMap - Pre-built UUID-to-username map for name resolution
 * @returns Formatted text block and structured holder records for article sidebar data
 */
async function buildTopHoldersSection(
  tokenId: number,
  playerNameMap: PlayerNameMap,
): Promise<{ text: string; holders: ArticleTopHolder[] }> {
  const holdings = await Q.crypto.holding.where({ tokenId }).all();

  if (holdings.length === 0) return { text: "", holders: [] };

  const sorted = [...holdings].sort((a, b) => Number(b.amount - a.amount));
  const top5 = sorted.slice(0, 5);

  const lines = [``, `=== TOP HOLDERS (focus token) ===`];
  const holders: ArticleTopHolder[] = [];

  for (const h of top5) {
    const name = resolvePlayerName(playerNameMap, h.playerMinecraftUuid);
    lines.push(
      `- ${name}: ${h.amount.toLocaleString()} tokens (cost basis: $${Number(h.totalCostBasis).toFixed(2)})`,
    );
    holders.push({
      name,
      amount: h.amount.toString(),
      costBasis: h.totalCostBasis,
    });
  }

  return { text: lines.join("\n"), holders };
}

/**
 * Summarizes pending limit orders for a token (buy count/volume vs. sell count/volume).
 * Returns an empty string when no pending orders exist.
 *
 * @private
 * @param tokenId - ID of the focus token
 * @returns Formatted text block describing open order book depth, or an empty string
 */
async function buildPendingOrdersSection(tokenId: number): Promise<string> {
  const orders = await Q.crypto.order
    .where({ tokenId, status: "pending" })
    .all();

  if (orders.length === 0) return "";

  let buyCount = 0;
  let sellCount = 0;
  let buyVolume = 0n;
  let sellVolume = 0n;

  for (const o of orders) {
    if (o.type === "limit_buy") {
      buyCount++;
      buyVolume += o.amount;
    } else {
      sellCount++;
      sellVolume += o.amount;
    }
  }

  return [
    ``,
    `=== PENDING ORDERS (focus token) ===`,
    `Buy orders: ${buyCount} (${buyVolume.toLocaleString()} tokens)`,
    `Sell orders: ${sellCount} (${sellVolume.toLocaleString()} tokens)`,
  ].join("\n");
}

/**
 * Fetches up to 3 recent market events (excluding the current one) to give the AI
 * narrative context for referencing prior market activity.
 *
 * @private
 * @param currentEventId - ID of the event being written about (excluded from results)
 * @returns Formatted text block listing recent event titles with relative timestamps
 */
async function buildPreviousEventsSection(
  currentEventId: number,
): Promise<string> {
  const events = await Q.crypto.market.event.getAll({
    orderBy: "createdAt",
    orderDirection: "desc",
    limit: 4,
  });

  const previous = events.filter((e) => e.id !== currentEventId).slice(0, 3);
  if (previous.length === 0) return "";

  const lines = [``, `=== RECENT EVENTS (for narrative continuity) ===`];
  for (const e of previous) {
    const ago = relativeTimeAgo(e.createdAt);
    lines.push(`- "${e.title}" - ${ago}`);
  }

  return lines.join("\n");
}

/**
 * Fetches the top 3 players by net worth for inclusion in the article.
 * Silently returns empty results on error so a leaderboard outage never blocks generation.
 *
 * @private
 * @returns Formatted text block and structured leaderboard entries for article sidebar data
 */
async function buildLeaderboardSection(): Promise<{
  text: string;
  entries: ArticleLeaderboardEntry[];
}> {
  try {
    const top3 = await getLeaderboard("networth", 3);
    if (top3.length === 0) return { text: "", entries: [] };

    const lines = [``, `=== TOP TRADERS (by net worth) ===`];
    const entries: ArticleLeaderboardEntry[] = [];

    for (const entry of top3) {
      lines.push(
        `#${entry.rank} ${entry.playerName}: $${Number(entry.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      );
      entries.push({
        rank: entry.rank,
        name: entry.playerName,
        value: entry.value,
      });
    }

    return { text: lines.join("\n"), entries };
  } catch {
    return { text: "", entries: [] };
  }
}

/**
 * Fetches current treasury stats (total fees collected and burned) for prompt context.
 * Returns an empty string when no treasury record exists.
 *
 * @private
 * @returns Formatted text block with treasury totals, or an empty string
 */
async function buildTreasurySection(): Promise<string> {
  const treasury = await Q.crypto.treasury.where({}).first();
  if (!treasury) return "";

  return [
    ``,
    `=== EXCHANGE TREASURY ===`,
    `Total fees collected: $${Number(treasury.totalCollected).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    `Total burned: $${Number(treasury.totalBurned).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
  ].join("\n");
}

/**
 * Fetches the last 30 minute-interval OHLCV candles for a token in chronological order.
 * Used to populate the price chart widget rendered alongside the article on the client.
 *
 * @private
 * @param tokenId - ID of the focus token
 * @returns Array of OHLCV candles sorted oldest-first, or an empty array if no history exists
 */
async function buildPriceHistoryData(
  tokenId: number,
): Promise<ArticlePriceCandle[]> {
  const snapshots = await Q.crypto.price.snapshot
    .where({ tokenId, interval: "tick" })
    .orderBy("recordedAt", "desc")
    .limit(60)
    .all();

  if (snapshots.length === 0) return [];

  // Reverse to chronological order
  return snapshots.reverse().map((s) => ({
    time: toUnixSeconds(s.recordedAt),
    open: Number(s.openPrice),
    high: Number(s.highPrice),
    low: Number(s.lowPrice),
    close: Number(s.closePrice),
  }));
}

/**
 * Converts a past date to a human-readable relative string (e.g. "5m ago", "2h ago").
 *
 * @private
 * @param date - The past timestamp to format
 * @returns Relative time string relative to the current moment
 */
function relativeTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Builds a full market snapshot to ground the AI prompt in real data.
 *
 * Assembles all context sections (market overview, token list, breadth, volume,
 * previous events, leaderboard, treasury, and focus-token detail) into a single
 * prompt string, while also collecting structured data for the article sidebar.
 *
 * @private
 * @param targetTokenId - Token the event targets, or null for market-wide events
 * @param eventId - ID of the event being written (used to exclude it from "previous events")
 * @returns The assembled prompt context string and structured article sidebar data
 */
async function buildMarketContext(
  targetTokenId: number | null,
  eventId: number,
): Promise<{ context: string; articleData: ArticleData }> {
  const cryptoService = await getService(Services.CRYPTO_MARKET_SERVICE);
  const playerNameMap = await buildPlayerNameMap();

  const allTokens = await Q.crypto.token.where({ isCrashed: false }).all();
  const activeTokens = allTokens.filter((t) => !t.delistedAt);

  const totalMarketCap = activeTokens.reduce(
    (sum, t) =>
      sum + Number(t.price) * Number(t.totalSupply - t.availableSupply),
    0,
  );

  const { topGainer, topLoser } = await cryptoService.getTopMovers();

  const sorted = activeTokens
    .map((t) => {
      const change24h = cryptoService.get24hChange(t.id, t.price);
      return {
        id: t.id,
        symbol: t.symbol,
        name: t.name,
        price: Number(t.price),
        marketCap: Number(t.price) * Number(t.totalSupply - t.availableSupply),
        change24h,
        category: t.category,
      };
    })
    .sort((a, b) => b.marketCap - a.marketCap);

  // === Market snapshot (existing) ===
  const lines: string[] = [
    `=== MARKET SNAPSHOT ===`,
    `Active tokens: ${activeTokens.length}`,
    `Total market cap: $${totalMarketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    topGainer
      ? `Top gainer: ${topGainer.symbol} (+${topGainer.change24h.toFixed(1)}%)`
      : "",
    topLoser
      ? `Top loser: ${topLoser.symbol} (${topLoser.change24h.toFixed(1)}%)`
      : "",
    ``,
    `=== TOKEN LIST (only reference these tokens) ===`,
  ].filter(Boolean);

  for (const t of sorted.slice(0, 20)) {
    const changeStr =
      t.change24h >= 0
        ? `+${t.change24h.toFixed(1)}%`
        : `${t.change24h.toFixed(1)}%`;
    lines.push(
      `- ${t.symbol} (${t.name}): $${t.price < 0.01 ? t.price.toFixed(6) : t.price.toFixed(2)} | 24h: ${changeStr} | MCap: $${t.marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })} | ${t.category}`,
    );
  }

  if (sorted.length > 20) {
    lines.push(`... and ${sorted.length - 20} more tokens`);
  }

  // === Market breadth ===
  const { text: breadthText, breadth } = buildMarketBreadthSection(sorted);
  lines.push(breadthText);

  // === Volume ===
  const volumeText = buildVolumeSection(cryptoService, sorted);
  if (volumeText) lines.push(volumeText);

  // === Previous events ===
  const prevEventsText = await buildPreviousEventsSection(eventId);
  if (prevEventsText) lines.push(prevEventsText);

  // === Leaderboard ===
  const { text: leaderboardText, entries: leaderboardTop3 } =
    await buildLeaderboardSection();
  if (leaderboardText) lines.push(leaderboardText);

  // === Treasury ===
  const treasuryText = await buildTreasurySection();
  if (treasuryText) lines.push(treasuryText);

  const articleData: ArticleData = {
    topHolders: [],
    recentTrades: [],
    marketBreadth: breadth,
    leaderboardTop3,
    tokenVolume24h: "0",
    totalVolume24h: cryptoService.getTotalVolume24h().toString(),
    priceHistory: [],
  };

  // === Focus token sections ===
  if (targetTokenId) {
    const target = allTokens.find((t) => t.id === targetTokenId);
    if (target) {
      const change24h = cryptoService.get24hChange(target.id, target.price);
      const changeStr =
        change24h >= 0
          ? `+${change24h.toFixed(1)}%`
          : `${change24h.toFixed(1)}%`;
      const held =
        Number(target.totalSupply) > 999999999
          ? "unlimited supply"
          : `${((1 - Number(target.availableSupply) / Number(target.totalSupply)) * 100).toFixed(1)}% held by players`;
      lines.push(
        ``,
        `=== FOCUS TOKEN ===`,
        `${target.symbol} (${target.name})`,
        `Price: $${Number(target.price).toFixed(Number(target.price) < 0.01 ? 6 : 2)}`,
        `24h change: ${changeStr}`,
        `Category: ${target.category}`,
        `Supply: ${held}`,
      );

      articleData.tokenVolume24h = cryptoService
        .getTokenVolume24h(targetTokenId)
        .toString();

      // Recent trades
      const { text: tradesText, trades } = await buildRecentTradesSection(
        targetTokenId,
        playerNameMap,
      );
      if (tradesText) lines.push(tradesText);
      articleData.recentTrades = trades;

      // Top holders
      const { text: holdersText, holders } = await buildTopHoldersSection(
        targetTokenId,
        playerNameMap,
      );
      if (holdersText) lines.push(holdersText);
      articleData.topHolders = holders;

      // Pending orders
      const ordersText = await buildPendingOrdersSection(targetTokenId);
      if (ordersText) lines.push(ordersText);

      // Price history for chart widget
      articleData.priceHistory = await buildPriceHistoryData(targetTokenId);
    }
  }

  return { context: lines.join("\n"), articleData };
}

/**
 * Generates an AI article for a market event and persists it to the database.
 *
 * Builds the market context prompt, calls the AI service, then updates the
 * event record with the generated article text and structured sidebar data
 * stored under `metadata.articleData`.
 *
 * @private
 * @param eventId - ID of the event to generate an article for
 * @param title - Event title used as the article subject
 * @param description - Optional event description included in the prompt
 * @param severity - Severity level that influences the article's tone
 * @param metadata - Event metadata containing token/trade context fields
 * @returns Promise that resolves when the article has been persisted
 */
async function generateArticleForEvent(
  eventId: number,
  title: string,
  description: string | null,
  severity: string,
  metadata: Record<string, unknown> | null,
): Promise<void> {
  const aiService = await getService(Services.AI_SERVICE);

  const tokenId = metadata?.tokenId ? Number(metadata.tokenId) : null;

  const { context: marketContext, articleData } = await buildMarketContext(
    tokenId,
    eventId,
  );

  const eventDetails = [
    `Event: ${title}`,
    description && `Description: ${description}`,
    `Severity: ${severity}`,
    metadata?.targetSymbol && `Affected token: ${metadata.targetSymbol}`,
    metadata?.tradeType && `Trade type: ${metadata.tradeType}`,
    metadata?.amount && `Amount: ${metadata.amount}`,
    metadata?.totalCost && `Total value: $${metadata.totalCost}`,
    metadata?.playerName && `Trader: ${metadata.playerName}`,
    metadata?.effects && `Effects: ${JSON.stringify(metadata.effects)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = [
    marketContext,
    ``,
    `=== EVENT TO COVER ===`,
    eventDetails,
    ``,
    `Write a news article covering this event. Use real token names and prices from the market snapshot above. Do not invent any tokens.`,
  ].join("\n");

  const article = await aiService.complete({
    system: SYSTEM_PROMPT,
    prompt,
    temperature: 0.85,
    maxTokens: 1200,
  });

  const enrichedMetadata = {
    ...(metadata ?? {}),
    articleData,
  };

  await Q.crypto.market.event.update(
    { id: eventId },
    { article, metadata: enrichedMetadata },
  );
}

/**
 * Enqueues an article for generation. Articles are processed serially so that
 * burst events (e.g. crash + whale + milestone) don't spawn parallel OpenAI
 * calls or redundant DB snapshot queries.
 *
 * @param eventId - ID of the event to generate an article for
 * @param title - Event title used as the article subject
 * @param description - Optional event description included in the prompt
 * @param severity - Severity level that influences the article's tone
 * @param metadata - Event metadata containing token/trade context fields
 */
export function fireAndForgetArticle(
  eventId: number,
  title: string,
  description: string | null,
  severity: string,
  metadata: Record<string, unknown> | null,
): void {
  if (!config.ai.enabled || config.envMode.isDevDeployment) return;

  articleQueue.push({ eventId, title, description, severity, metadata });
  processQueue().catch((err) => {
    logger.warn(`Article queue processing failed: ${err}`);
  });
}
