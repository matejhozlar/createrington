/**
 * Token reservation accounting for pending sell-type orders.
 * A pending limit_sell, stop_loss, or take_profit "reserves" the tokens that
 * back it so they cannot also be spent by a market sell.
 */

import { Q } from "@/db";
import type { CryptoQueries } from "@/db/queries/crypto";

/**
 * Sums the tokens reserved across a player's pending sell-type orders for a
 * single token.
 *
 * @param playerUuid - Minecraft UUID of the order placer
 * @param tokenId - Token to total reservations for
 * @param txCrypto - Optional transaction-bound CryptoQueries for atomic operations
 * @returns Total reserved token amount
 */
export async function getReservedTokens(
  playerUuid: string,
  tokenId: number,
  txCrypto?: CryptoQueries,
): Promise<bigint> {
  const crypto = txCrypto ?? Q.crypto;
  const orders = await crypto.order
    .where({
      playerMinecraftUuid: playerUuid,
      tokenId,
      status: "pending",
    })
    .all();

  return orders.reduce((sum, o) => sum + o.reservedTokens, 0n);
}
