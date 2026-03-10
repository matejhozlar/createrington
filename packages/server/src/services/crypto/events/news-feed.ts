import { Q } from "@/db";
import type { CryptoMarketEvent } from "@createrington/shared/db/crypto_market_event.types";

export type MarketEventType =
	| "new_listing"
	| "crash"
	| "whale_trade"
	| "price_milestone"
	| "high_volume";

/**
 * Persists a market event to the news feed.
 *
 * Defaults severity to `"info"` and metadata to an empty object when omitted.
 *
 * @param params - Event fields; `type` and `title` are required, all others optional
 * @returns The newly created market event record
 */
export async function createMarketEvent(params: {
	type: MarketEventType;
	title: string;
	description?: string;
	tokenId?: number;
	severity?: "info" | "warning" | "critical";
	metadata?: Record<string, unknown>;
	activeUntil?: Date;
}): Promise<CryptoMarketEvent> {
	return Q.crypto.market.event.createAndReturn({
		type: params.type,
		title: params.title,
		description: params.description ?? null,
		tokenId: params.tokenId ?? null,
		severity: params.severity ?? "info",
		metadata: params.metadata ?? {},
		activeUntil: params.activeUntil ?? null,
	});
}

/**
 * Returns the most recent market events, newest first.
 *
 * @param limit - Maximum number of events to return (default 20)
 * @returns Events ordered by creation time descending
 */
export async function getRecentEvents(
	limit = 20,
): Promise<CryptoMarketEvent[]> {
	return Q.crypto.market.event
		.where({})
		.orderBy("createdAt", "desc")
		.limit(limit)
		.all();
}

/**
 * Returns events whose `activeUntil` timestamp is still in the future.
 *
 * NOTE: Filtering is done in application code because the query layer does not
 * expose a greater-than filter on timestamp columns.
 *
 * @returns Currently active market events
 */
export async function getActiveEvents(): Promise<CryptoMarketEvent[]> {
	const all = await Q.crypto.market.event.where({}).all();
	const now = new Date();
	return all.filter(
		(e) => e.activeUntil && e.activeUntil > now,
	);
}

/**
 * Records a large trade as a whale-alert market event.
 *
 * @param playerName - Display name of the player who made the trade
 * @param tokenSymbol - Symbol of the traded token (e.g. "BTC")
 * @param tokenId - ID of the traded token
 * @param tradeType - Whether the player bought or sold
 * @param amount - Token quantity traded
 * @param totalCost - Total USD value of the trade
 * @returns The created whale-alert market event record
 */
export async function recordWhaleEvent(
	playerName: string,
	tokenSymbol: string,
	tokenId: number,
	tradeType: "buy" | "sell",
	amount: string,
	totalCost: string,
): Promise<CryptoMarketEvent> {
	const action = tradeType === "buy" ? "bought" : "sold";
	return createMarketEvent({
		type: "whale_trade",
		title: `Whale Alert: ${playerName} ${action} ${amount} ${tokenSymbol}`,
		description: `A large trade of $${Number(totalCost).toFixed(2)} was executed`,
		tokenId,
		severity: "warning",
		metadata: { playerName, tradeType, amount, totalCost },
	});
}
