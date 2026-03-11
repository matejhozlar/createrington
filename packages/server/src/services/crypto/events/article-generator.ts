import { Q } from "@/db";
import { getService } from "@/services";
import { Services } from "@/services/container";

const SYSTEM_PROMPT = `You are a dramatic financial news reporter covering a fictional Minecraft server's cryptocurrency market called "Createrington Exchange". Write short, entertaining news articles about market events.

Rules:
- Write 2-3 short paragraphs
- Be dramatic and entertaining — this is a fun, fictional economy
- Reference the Minecraft/Create mod context occasionally (redstone, contraptions, builds, etc.)
- Use financial journalism style but keep it lighthearted
- Do not use markdown formatting, just plain text with paragraph breaks
- Do not include a headline — the title is already provided separately`;

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

  const details = [
    `Event: ${title}`,
    description && `Summary: ${description}`,
    severity && `Severity: ${severity}`,
    metadata?.targetSymbol && `Token: ${metadata.targetSymbol}`,
    metadata?.tradeType && `Trade type: ${metadata.tradeType}`,
    metadata?.amount && `Amount: ${metadata.amount}`,
    metadata?.totalCost && `Total value: $${metadata.totalCost}`,
    metadata?.playerName && `Trader: ${metadata.playerName}`,
  ]
    .filter(Boolean)
    .join("\n");

  const article = await aiService.complete({
    system: SYSTEM_PROMPT,
    prompt: `Write a short news article about this market event:\n\n${details}`,
    temperature: 0.9,
    maxTokens: 300,
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
