import { Q } from "@/db";
import { sendIpoResultNotification } from "../notifications";

/**
 * Finds tokens whose IPO has ended and transitions them to normal trading.
 * Sends result notifications and clears IPO fields so the price engine picks them up.
 */
export async function transitionEndedIpos(): Promise<void> {
  const allMemecoins = await Q.crypto.token
    .where({ category: "memecoin", isCrashed: false })
    .all();

  const now = new Date();

  for (const token of allMemecoins) {
    if (!token.ipoEndsAt || token.ipoEndsAt > now) continue;

    // IPO has ended: gather results before clearing
    const holdings = await Q.crypto.holding.where({ tokenId: token.id }).all();

    const totalSold = token.totalSupply - token.availableSupply;
    const participants = holdings.length;

    // Clear IPO fields: token enters normal trading
    await Q.crypto.token.update({ id: token.id }, { ipoEndsAt: null });

    sendIpoResultNotification(
      token.name,
      token.symbol,
      token.ipoPrice!,
      totalSold,
      token.totalSupply,
      participants,
    ).catch((err) =>
      logger.error("Failed to send IPO result notification:", err),
    );

    logger.info(
      `IPO ended for ${token.symbol}: ${totalSold} sold to ${participants} participants`,
    );
  }
}
