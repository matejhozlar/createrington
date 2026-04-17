import { Q, R } from "@/db";
import { BalanceTransactionType } from "@/db/repositories/balance";
import { createMarketEvent } from "../events/news-feed";

/**
 * Delists a token: auto-sells all player holdings at current price and marks
 * the token as delisted. Publishes a market-event news item.
 *
 * No-op when the token is already crashed.
 *
 * @param tokenId - ID of the token to delist
 */
export async function delistToken(tokenId: number): Promise<void> {
  const token = await Q.crypto.token.get({ id: tokenId });
  if (token.isCrashed) return;

  const finalPrice = Number(token.price);

  // Find all holders
  const holdings = await Q.crypto.holding.where({ tokenId: token.id }).all();

  // Auto-sell each holder's position at the final price
  for (const holding of holdings) {
    const amount = Number(holding.amount);
    const revenue = Math.floor(amount * finalPrice * 1000) / 1000;

    if (revenue > 0) {
      await R.balanceRepo.add(
        { minecraftUuid: holding.playerMinecraftUuid },
        revenue,
        `Auto-delist: ${amount} ${token.symbol} @ $${finalPrice.toFixed(4)}`,
        BalanceTransactionType.CRYPTO_SELL,
        {
          tokenId: token.id,
          tokenSymbol: token.symbol,
          amount,
          price: finalPrice,
          fee: 0,
          trigger: "auto_delist",
        },
      );
    }

    // Record the transaction
    await Q.crypto.transaction.create({
      playerMinecraftUuid: holding.playerMinecraftUuid,
      tokenId: token.id,
      type: "sell",
      trigger: "auto_delist",
      amount: holding.amount,
      priceAtExecution: token.price,
      feeAmount: "0",
      totalCost: revenue.toFixed(8),
    });

    // Delete the holding
    await Q.crypto.holding.delete({ id: holding.id });
  }

  // Mark token as delisted
  await Q.crypto.token.update(
    { id: token.id },
    {
      delistedAt: new Date(),
      isCrashed: true, // prevents further trading
      crashedAt: new Date(),
    },
  );

  // Record news event
  await createMarketEvent({
    type: "token_delisted",
    title: `${token.name} (${token.symbol}) Delisted`,
    description: `All holdings were auto-sold at $${finalPrice.toFixed(4)}. ${holdings.length} holders received payouts.`,
    tokenId: token.id,
    severity: "warning",
  });

  logger.info(
    `Delisted token ${token.symbol}: ${holdings.length} holdings auto-sold at $${finalPrice.toFixed(4)}`,
  );
}

/**
 * Finds seasonal tokens past their delist date and auto-sells all holdings
 * via {@link delistToken}. Skips tokens already marked as crashed.
 */
export async function processExpiredSeasonalTokens(): Promise<void> {
  const seasonalTokens = await Q.crypto.token
    .where({ category: "seasonal" })
    .all();

  const now = new Date();

  for (const token of seasonalTokens) {
    if (!token.delistedAt || token.delistedAt > now) continue;
    if (token.isCrashed) continue; // already processed

    await delistToken(token.id);
  }
}
