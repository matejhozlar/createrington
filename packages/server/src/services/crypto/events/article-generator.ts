import { Q } from "@/db";
import { getService } from "@/services";
import { Services } from "@/services/container";

const SYSTEM_PROMPT = `You are a seasoned financial journalist writing for the Createrington Exchange — a fictional cryptocurrency market on a Minecraft server powered by the Create mod.

Your articles read like real Bloomberg or WSJ coverage, but with a fun Minecraft twist. Players trade memecoins, speculate on volatile tokens, and react to market events — all within a blocky economy of redstone, contraptions, and cobblestone fortunes.

Style guide:
- Write 3-4 paragraphs, each 2-3 sentences
- Lead with the most impactful fact or development
- Quote fictional analysts, traders, or market observers by name (make up Minecraft-themed names like "RedstoneRick", "CopperCog", "PistonPete")
- Include specific numbers from the data provided (prices, percentages, volumes) — never invent figures
- Reference Minecraft/Create mod context naturally (redstone circuits, mechanical crafters, server builds, andesite alloy, etc.)
- Vary tone by severity: "info" events are optimistic/neutral, "warning" events are cautious, "critical" events are urgent
- Do not use markdown formatting — plain text with paragraph breaks only
- Do not include a headline or title — it is provided separately
- Only reference tokens from the provided token list — never invent token names or symbols`;

/**
 * Builds a snapshot of the current market to ground the AI in real data.
 */
async function buildMarketContext(
  targetTokenId: number | null,
): Promise<string> {
  const cryptoService = await getService(Services.CRYPTO_MARKET_SERVICE);

  const allTokens = await Q.crypto.token
    .where({ isCrashed: false })
    .all();

  const activeTokens = allTokens.filter((t) => !t.delistedAt);

  const totalMarketCap = activeTokens.reduce(
    (sum, t) =>
      sum + Number(t.price) * Number(t.totalSupply - t.availableSupply),
    0,
  );

  const { topGainer, topLoser } = await cryptoService.getTopMovers();

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

  // Sort by market cap descending, show top tokens
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

  // If there's a specific target token, add extra detail
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
    }
  }

  return lines.join("\n");
}

/**
 * Generates an AI article for a market event and persists it to the database.
 * Completely fire-and-forget — errors are logged but never thrown.
 */
async function generateArticleForEvent(
  eventId: number,
  title: string,
  description: string | null,
  severity: string,
  metadata: Record<string, unknown> | null,
): Promise<void> {
  const aiService = await getService(Services.AI_SERVICE);

  const tokenId = metadata?.tokenId
    ? Number(metadata.tokenId)
    : null;

  const marketContext = await buildMarketContext(tokenId);

  const eventDetails = [
    `Event: ${title}`,
    description && `Description: ${description}`,
    `Severity: ${severity}`,
    metadata?.targetSymbol && `Affected token: ${metadata.targetSymbol}`,
    metadata?.tradeType && `Trade type: ${metadata.tradeType}`,
    metadata?.amount && `Amount: ${metadata.amount}`,
    metadata?.totalCost && `Total value: $${metadata.totalCost}`,
    metadata?.playerName && `Trader: ${metadata.playerName}`,
    metadata?.effects &&
      `Effects: ${JSON.stringify(metadata.effects)}`,
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
    maxTokens: 500,
  });

  await Q.crypto.market.event.update({ id: eventId }, { article });
}

/**
 * Fire-and-forget wrapper for article generation.
 * Silently catches all errors — the event is already persisted regardless.
 */
export function fireAndForgetArticle(
  eventId: number,
  title: string,
  description: string | null,
  severity: string,
  metadata: Record<string, unknown> | null,
): void {
  generateArticleForEvent(eventId, title, description, severity, metadata).catch(
    (err) => {
      logger.warn(`Failed to generate article for event ${eventId}: ${err}`);
    },
  );
}
