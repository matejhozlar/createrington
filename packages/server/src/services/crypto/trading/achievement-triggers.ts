/**
 * Crypto trading achievement triggers.
 *
 * Called from the trade executor (fire-and-forget) and from tRPC routes
 * (awaited, returns newly earned achievement names for client toasts).
 */

import { Q } from "@/db";
import { getService, Services } from "@/services";
import { getGroupById, type AchievementService } from "@/services/achievement";
import type { CryptoToken } from "@createrington/shared/db/crypto_token.types";
import type { TradeResult } from "./trade-executor";

const PAPER_HANDS_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const WHALE_HOLDING_THRESHOLD = 0.1; // 10% of total supply
const TEN_X_MULTIPLIER = 10;

/**
 * Fire-and-forget achievement evaluation after a trade (from executor/order fills)
 *
 * @param playerUuid - Minecraft UUID of the player who made the trade
 * @param token - The token that was traded
 * @param result - The completed trade result to evaluate
 */
export function triggerTradeAchievements(
  playerUuid: string,
  token: CryptoToken,
  result: TradeResult,
): void {
  evaluateTradeAchievements(playerUuid, token, result).catch((err) =>
    logger.error("Failed to evaluate trade achievements:", err),
  );
}

/**
 * Evaluate trade achievements and return newly earned names.
 *
 * Runs both event-based checks (paper hands, 10x return, whale holding) and
 * threshold-based checks (first trade, diversified, market veteran, wolf).
 * Used by tRPC routes to include achievement unlocks in the trade response.
 *
 * @param playerUuid - Minecraft UUID of the player who made the trade
 * @param token - The token that was traded
 * @param result - The completed trade result to evaluate
 * @returns Display names of all achievements newly earned by this trade
 */
export async function evaluateTradeAchievements(
  playerUuid: string,
  token: CryptoToken,
  result: TradeResult,
): Promise<string[]> {
  const achievementService = await getService(
    Services.ACHIEVEMENT_SERVICE,
  ).catch(() => null);

  if (!achievementService) return [];

  const newAchievements: string[] = [];

  // Run event-based checks
  if (result.type === "sell") {
    const paperHands = await checkPaperHands(achievementService, playerUuid, token.id);
    if (paperHands) newAchievements.push(paperHands);

    const tenX = await check10xReturn(achievementService, playerUuid, result);
    if (tenX) newAchievements.push(tenX);
  }

  if (result.type === "buy") {
    const whale = await checkWhaleHolding(achievementService, playerUuid, token);
    if (whale) newAchievements.push(whale);
  }

  // Run threshold-based evaluation (First Trade, Diversified, Market Veteran, Wolf)
  const thresholdNew = await achievementService.evaluateCryptoAchievements(playerUuid);
  newAchievements.push(...thresholdNew);

  return newAchievements;
}

/**
 * Paper Hands: award achievement when a player sells within 5 minutes of buying the same token
 *
 * @private
 * @param service - Achievement service used to award the event
 * @param playerUuid - Minecraft UUID of the selling player
 * @param tokenId - ID of the token being sold
 * @returns Display name of the awarded achievement, or null if not triggered
 */
async function checkPaperHands(
  service: AchievementService,
  playerUuid: string,
  tokenId: number,
): Promise<string | null> {
  const fiveMinAgo = new Date(Date.now() - PAPER_HANDS_WINDOW_MS);

  const recentBuys = await Q.crypto.transaction
    .where({
      playerMinecraftUuid: playerUuid,
      tokenId,
      type: "buy",
    })
    .orderBy("createdAt", "desc")
    .all();

  const hasRecentBuy = recentBuys.some(
    (tx) => tx.createdAt >= fiveMinAgo,
  );

  if (hasRecentBuy) {
    const awarded = await service.awardCryptoEvent(playerUuid, "crypto_paper_hands");
    if (awarded) return getGroupById("crypto_paper_hands")?.name ?? null;
  }

  return null;
}

/**
 * 10x Return: award achievement when the sell price is at least 10x any open cost-basis lot
 *
 * @private
 * @param service - Achievement service used to award the event
 * @param playerUuid - Minecraft UUID of the selling player
 * @param result - The completed sell trade result containing price and token info
 * @returns Display name of the awarded achievement, or null if not triggered
 */
async function check10xReturn(
  service: AchievementService,
  playerUuid: string,
  result: TradeResult,
): Promise<string | null> {
  const sellPrice = Number(result.priceAtExecution);

  // Check remaining cost basis lots — if sell price >= 10x any lot's entry price
  const lots = await Q.crypto.cost.basis
    .where({
      playerMinecraftUuid: playerUuid,
      tokenId: result.tokenId,
    })
    .orderBy("acquiredAt", "asc")
    .all();

  for (const lot of lots) {
    const entryPrice = Number(lot.pricePerUnit);
    if (entryPrice > 0 && sellPrice / entryPrice >= TEN_X_MULTIPLIER) {
      const awarded = await service.awardCryptoEvent(playerUuid, "crypto_10x_return");
      if (awarded) return getGroupById("crypto_10x_return")?.name ?? null;
      return null;
    }
  }

  return null;
}

/**
 * Whale: award achievement when a player holds more than 10% of a token's total supply
 *
 * @private
 * @param service - Achievement service used to award the event
 * @param playerUuid - Minecraft UUID of the buying player
 * @param token - The token just purchased, including its total supply
 * @returns Display name of the awarded achievement, or null if not triggered
 */
async function checkWhaleHolding(
  service: AchievementService,
  playerUuid: string,
  token: CryptoToken,
): Promise<string | null> {
  const holding = await Q.crypto.holding
    .where({
      playerMinecraftUuid: playerUuid,
      tokenId: token.id,
    })
    .first()
    .catch(() => null);

  if (!holding) return null;

  const holdingRatio = Number(holding.amount) / Number(token.totalSupply);
  if (holdingRatio >= WHALE_HOLDING_THRESHOLD) {
    const awarded = await service.awardCryptoEvent(playerUuid, "crypto_whale");
    if (awarded) return getGroupById("crypto_whale")?.name ?? null;
  }

  return null;
}
