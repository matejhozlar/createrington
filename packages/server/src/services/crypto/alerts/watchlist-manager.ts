/**
 * Watchlist management for crypto tokens.
 * Allows players to maintain a personal list of tokens to monitor:
 * - Fetching all tokens currently on a player's watchlist
 * - Adding tokens with duplicate and size-cap enforcement
 * - Removing tokens by player UUID and token ID
 */

import { Q } from "@/db";
import { cryptoSetting } from "../settings/accessor";
import type { CryptoWatchlist } from "@createrington/shared/db/crypto_watchlist.types";

/** Returns all watchlist entries for a given player. */
export async function getWatchlist(
  playerUuid: string,
): Promise<CryptoWatchlist[]> {
  return Q.crypto.watchlist.where({ playerMinecraftUuid: playerUuid }).all();
}

/**
 * Adds a token to a player's watchlist.
 *
 * Throws if the token is already on the watchlist or if the player has reached
 * the maximum watchlist size defined in `CRYPTO_CONFIG.MAX_WATCHLIST_SIZE`.
 *
 * @param playerUuid - Minecraft UUID of the player
 * @param tokenId - ID of the crypto token to watch
 * @returns The newly created watchlist entry
 */
export async function addToWatchlist(
  playerUuid: string,
  tokenId: number,
): Promise<CryptoWatchlist> {
  const existing = await Q.crypto.watchlist
    .where({ playerMinecraftUuid: playerUuid, tokenId })
    .first();

  if (existing) {
    throw new Error("Token is already in your watchlist");
  }

  const count = await Q.crypto.watchlist
    .where({ playerMinecraftUuid: playerUuid })
    .count();

  const max = cryptoSetting("MAX_WATCHLIST_SIZE");
  if (count >= max) {
    throw new Error(`Watchlist is full (max ${max} tokens)`);
  }

  return Q.crypto.watchlist.createAndReturn({
    playerMinecraftUuid: playerUuid,
    tokenId,
  });
}

/**
 * Removes a token from a player's watchlist.
 *
 * Throws if the token is not currently on the player's watchlist.
 *
 * @param playerUuid - Minecraft UUID of the player
 * @param tokenId - ID of the crypto token to remove
 */
export async function removeFromWatchlist(
  playerUuid: string,
  tokenId: number,
): Promise<void> {
  const entry = await Q.crypto.watchlist
    .where({ playerMinecraftUuid: playerUuid, tokenId })
    .first();

  if (!entry) {
    throw new Error("Token is not in your watchlist");
  }

  await Q.crypto.watchlist.delete({ id: entry.id });
}
