/**
 * Lifetime trade count lookup, used by the fee calculator to apply
 * volume-based discounts.
 */

import { Q } from "@/db";

/** Total number of trades a player has ever executed (drives volume fee discounts). */
export async function getLifetimeTradeCount(
  playerUuid: string,
): Promise<number> {
  return Q.crypto.transaction.count({ playerMinecraftUuid: playerUuid });
}
