import { Q } from "@/db";
import { CRYPTO_CONFIG } from "../crypto.config";
import type { CryptoPriceAlert } from "@createrington/shared/db/crypto_price_alert.types";

export interface TriggeredAlert {
	alertId: number;
	playerUuid: string;
	tokenId: number;
	tokenSymbol: string;
	targetPrice: string;
	direction: "above" | "below";
	currentPrice: string;
}

/** Returns all untriggered price alerts for a given player. */
export async function getPlayerAlerts(
	playerUuid: string,
): Promise<CryptoPriceAlert[]> {
	return Q.crypto.price.alert
		.where({ playerMinecraftUuid: playerUuid, triggered: false })
		.all();
}

/**
 * Creates a new price alert for a player.
 *
 * Throws if the player already has the maximum number of active alerts
 * defined by `CRYPTO_CONFIG.MAX_ACTIVE_ALERTS`.
 *
 * @param playerUuid - Minecraft UUID of the player
 * @param tokenId - ID of the token to watch
 * @param targetPrice - Price threshold that should trigger the alert
 * @param direction - Whether to alert when the price goes above or below the target
 * @returns The newly created price alert record
 */
export async function createAlert(
	playerUuid: string,
	tokenId: number,
	targetPrice: string,
	direction: "above" | "below",
): Promise<CryptoPriceAlert> {
	const count = await Q.crypto.price.alert
		.where({ playerMinecraftUuid: playerUuid, triggered: false })
		.count();

	if (count >= CRYPTO_CONFIG.MAX_ACTIVE_ALERTS) {
		throw new Error(
			`Max ${CRYPTO_CONFIG.MAX_ACTIVE_ALERTS} active alerts allowed`,
		);
	}

	return Q.crypto.price.alert.createAndReturn({
		playerMinecraftUuid: playerUuid,
		tokenId,
		targetPrice,
		direction,
	});
}

/**
 * Deletes a price alert owned by the given player.
 *
 * Throws if the alert does not exist or belongs to a different player.
 *
 * @param playerUuid - Minecraft UUID of the player
 * @param alertId - ID of the alert to delete
 */
export async function deleteAlert(
	playerUuid: string,
	alertId: number,
): Promise<void> {
	const alert = await Q.crypto.price.alert.get({ id: alertId });

	if (!alert || alert.playerMinecraftUuid !== playerUuid) {
		throw new Error("Alert not found");
	}

	await Q.crypto.price.alert.delete({ id: alertId });
}

/**
 * Checks all pending alerts against current token prices.
 *
 * For each untriggered alert whose condition is now met, marks it as triggered
 * in the database and collects it into the returned list so the caller can
 * dispatch notifications.
 *
 * @param tokenPrices - Map of token ID to current price and symbol
 * @returns Array of alerts that fired during this check
 */
export async function checkAlerts(
	tokenPrices: Map<number, { price: string; symbol: string }>,
): Promise<TriggeredAlert[]> {
	const pendingAlerts = await Q.crypto.price.alert
		.where({ triggered: false })
		.all();

	const triggered: TriggeredAlert[] = [];

	for (const alert of pendingAlerts) {
		const tokenData = tokenPrices.get(alert.tokenId);
		if (!tokenData) continue;

		const currentPrice = Number(tokenData.price);
		const target = Number(alert.targetPrice);

		const shouldTrigger =
			(alert.direction === "above" && currentPrice >= target) ||
			(alert.direction === "below" && currentPrice <= target);

		if (shouldTrigger) {
			await Q.crypto.price.alert.update(
				{ id: alert.id },
				{ triggered: true, triggeredAt: new Date() },
			);

			triggered.push({
				alertId: alert.id,
				playerUuid: alert.playerMinecraftUuid,
				tokenId: alert.tokenId,
				tokenSymbol: tokenData.symbol,
				targetPrice: alert.targetPrice,
				direction: alert.direction,
				currentPrice: tokenData.price,
			});
		}
	}

	return triggered;
}
