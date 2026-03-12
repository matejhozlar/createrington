/**
 * Event engine for the crypto market.
 *
 * Handles:
 * - Random event rolling (hourly probability check)
 * - Active event state tracking
 * - Event effect resolution (what modifiers apply to the price engine right now)
 * - Event lifecycle (start → active → end)
 * - Instant event execution (flash crash, supply shock, whale dump)
 */

import { Q } from "@/db";
import { CRYPTO_CONFIG } from "../crypto.config";
import {
  EVENT_DEFINITIONS,
  type MarketEventType,
  type EventEffect,
  type EventDefinition,
} from "./event-definitions";
import { createMarketEvent } from "./news-feed";
import type { CryptoToken } from "@createrington/shared/db/crypto_token.types";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface ActiveEvent {
  /** Database event ID */
  eventId: number;
  /** Event type key */
  type: MarketEventType;
  /** When the event ends (null for instant events that already resolved) */
  activeUntil: Date | null;
  /** Resolved effects for this event instance */
  effects: EventEffect;
  /** Token ID if token-scoped, null if market-wide */
  tokenId: number | null;
  /** Token symbol if token-scoped */
  tokenSymbol: string | null;
  /** For pump_and_dump: timestamp when the bias should flip */
  phaseFlipAt?: number;
}

/** Combined effects from all currently active events */
export interface ResolvedEffects {
  volatilityMultiplier: number;
  directionBias: number;
  feeMultiplier: number;
  stablecoinInflationMultiplier: number;
}

// ---------------------------------------------------------------------------
// IN-MEMORY STATE
// ---------------------------------------------------------------------------

const activeEvents: ActiveEvent[] = [];

// ---------------------------------------------------------------------------
// PUBLIC API: Event state
// ---------------------------------------------------------------------------

/** Returns all currently active (non-expired) events */
export function getActiveEventsInMemory(): ActiveEvent[] {
  pruneExpiredEvents();
  return [...activeEvents];
}

/**
 * Resolves the combined effects of all active events for a given token.
 * Market-wide events always apply. Token-specific events only apply to
 * the targeted token.
 */
export function resolveEffects(tokenId?: number): ResolvedEffects {
  pruneExpiredEvents();

  const result: ResolvedEffects = {
    volatilityMultiplier: 1,
    directionBias: 0,
    feeMultiplier: 1,
    stablecoinInflationMultiplier: 1,
  };

  for (const event of activeEvents) {
    // Skip token-specific events that don't match
    if (event.tokenId !== null && event.tokenId !== tokenId) continue;

    const effects = getEffectsForPhase(event);

    if (effects.volatilityMultiplier !== undefined) {
      result.volatilityMultiplier *= effects.volatilityMultiplier;
    }
    if (effects.directionBias !== undefined) {
      result.directionBias += effects.directionBias;
    }
    if (effects.feeMultiplier !== undefined) {
      result.feeMultiplier *= effects.feeMultiplier;
    }
    if (effects.stablecoinInflationMultiplier !== undefined) {
      result.stablecoinInflationMultiplier *=
        effects.stablecoinInflationMultiplier;
    }
  }

  return result;
}

/**
 * Returns the current fee multiplier from active events.
 * Used by the fee calculator to adjust fees during events.
 */
export function getEventFeeMultiplier(): number {
  return resolveEffects().feeMultiplier;
}

// ---------------------------------------------------------------------------
// PUBLIC API: Event rolling
// ---------------------------------------------------------------------------

/**
 * Rolls for random market events. Called once per hour.
 * Each event type has an independent probability check.
 * Only one event of each type can be active at a time.
 * Maximum of 2 concurrent active events to avoid chaos.
 */
export async function rollForEvents(): Promise<ActiveEvent[]> {
  pruneExpiredEvents();

  const newEvents: ActiveEvent[] = [];
  const MAX_CONCURRENT_EVENTS = 2;

  if (activeEvents.length >= MAX_CONCURRENT_EVENTS) {
    return newEvents;
  }

  const eventTypes = Object.keys(EVENT_DEFINITIONS) as MarketEventType[];

  for (const eventType of eventTypes) {
    if (activeEvents.length + newEvents.length >= MAX_CONCURRENT_EVENTS) break;

    const def = EVENT_DEFINITIONS[eventType];
    if (def.probability <= 0) continue;

    // Skip if this event type is already active
    if (activeEvents.some((e) => e.type === eventType)) continue;

    if (Math.random() < def.probability) {
      const event = await executeEvent(eventType);
      if (event) newEvents.push(event);
    }
  }

  return newEvents;
}

/**
 * Manually triggers a specific event type. Used by admin commands.
 *
 * @param eventType - The event type to trigger
 * @param tokenId - Optional token ID for token-scoped events
 * @returns The activated event, or null if the event couldn't be started
 */
export async function triggerEvent(
  eventType: MarketEventType,
  tokenId?: number,
): Promise<ActiveEvent | null> {
  // Remove existing event of the same type if any
  const existingIdx = activeEvents.findIndex((e) => e.type === eventType);
  if (existingIdx !== -1) {
    const existing = activeEvents[existingIdx];
    activeEvents.splice(existingIdx, 1);

    // Expire the old DB record so it doesn't resurface in queries or on restart
    await Q.crypto.market.event.update(
      { id: existing.eventId },
      { activeUntil: new Date() },
    );
  }

  return executeEvent(eventType, tokenId);
}

// ---------------------------------------------------------------------------
// INTERNAL: Event execution
// ---------------------------------------------------------------------------

/**
 * Executes a market event end-to-end: resolves the target token, calculates
 * duration, applies any instant effects, persists to the database, and
 * registers the event in the in-memory active list.
 *
 * Instant events (no durationMs) fire once and are not tracked in memory.
 *
 * @param eventType - The event type to execute
 * @param forcedTokenId - Pin the event to a specific token instead of picking randomly
 * @returns The activated event, or null if no valid target token could be found
 * @private
 */
async function executeEvent(
  eventType: MarketEventType,
  forcedTokenId?: number,
): Promise<ActiveEvent | null> {
  const def = EVENT_DEFINITIONS[eventType];

  // Resolve target token for token-scoped events
  let targetToken: CryptoToken | null = null;
  if (def.scope === "token") {
    if (forcedTokenId) {
      targetToken = await Q.crypto.token.get({ id: forcedTokenId });
    } else {
      targetToken = await pickRandomTarget(def);
    }
    if (!targetToken) {
      logger.warn(`Event ${eventType}: no valid target token found, skipping`);
      return null;
    }
  }

  // Calculate duration
  let activeUntil: Date | null = null;
  if (def.durationMs) {
    const [minMs, maxMs] = def.durationMs;
    const durationMs = minMs + Math.random() * (maxMs - minMs);
    activeUntil = new Date(Date.now() + durationMs);
  }

  // Resolve description with token placeholder
  let description = def.description;
  if (targetToken) {
    description = description.replace(
      "{token}",
      `**${targetToken.name}** (${targetToken.symbol})`,
    );
  }

  // Apply instant effects before recording
  if (targetToken) {
    await applyInstantEffects(def.effects, targetToken);
  }

  // Record to database
  const dbEvent = await createMarketEvent({
    type: eventType,
    title: def.name,
    description,
    tokenId: targetToken?.id,
    severity: def.severity,
    activeUntil: activeUntil ?? undefined,
    metadata: {
      eventType,
      effects: def.effects,
      targetSymbol: targetToken?.symbol,
      tokenId: targetToken?.id,
    },
  });

  const event: ActiveEvent = {
    eventId: dbEvent.id,
    type: eventType,
    activeUntil,
    effects: { ...def.effects },
    tokenId: targetToken?.id ?? null,
    tokenSymbol: targetToken?.symbol ?? null,
  };

  // Special handling for pump_and_dump: schedule phase flip
  if (eventType === "pump_and_dump" && activeUntil) {
    event.phaseFlipAt = Date.now() + (activeUntil.getTime() - Date.now()) / 2;
  }

  // Only track duration-based events in active list (instant events fire once)
  if (activeUntil) {
    activeEvents.push(event);
  }

  logger.info(
    `Market event started: ${def.name}${targetToken ? ` (${targetToken.symbol})` : ""}${activeUntil ? ` until ${activeUntil.toISOString()}` : " (instant)"}`,
  );

  return event;
}

// ---------------------------------------------------------------------------
// INTERNAL: Helpers
// ---------------------------------------------------------------------------

/**
 * Picks a random non-crashed, non-delisted token from the event's allowed
 * target categories. Returns null if no eligible candidates exist.
 *
 * @param def - The event definition containing targetCategories
 * @returns A randomly selected token, or null if no candidates are available
 * @private
 */
async function pickRandomTarget(
  def: EventDefinition,
): Promise<CryptoToken | null> {
  const categories = def.targetCategories ?? ["memecoin"];
  const allTokens = await Q.crypto.token.where({ isCrashed: false }).all();
  const candidates = allTokens.filter(
    (t) =>
      categories.includes(
        t.category as "memecoin" | "stable" | "blue_chip" | "seasonal",
      ) && !t.delistedAt,
  );

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Applies one-shot price and supply changes to a token immediately on event
 * start. The final magnitude is randomized within ±40% of the defined value
 * so consecutive identical events don't produce the exact same outcome.
 *
 * @param effects - The event effects descriptor (only instant fields are used)
 * @param token - The token to modify
 * @private
 */
async function applyInstantEffects(
  effects: EventEffect,
  token: CryptoToken,
): Promise<void> {
  // Instant price change
  if (effects.instantPriceChange !== undefined) {
    const currentPrice = Number(token.price);
    // Randomize around the defined value (e.g. -0.35 becomes range -0.20 to -0.50)
    const magnitude = Math.abs(effects.instantPriceChange);
    const randomized =
      Math.sign(effects.instantPriceChange) *
      (magnitude * 0.6 + Math.random() * magnitude * 0.8);
    const newPrice = Math.max(
      CRYPTO_CONFIG.MEMECOIN_CRASH_THRESHOLD,
      currentPrice * (1 + randomized),
    );

    await Q.crypto.token.update(
      { id: token.id },
      { price: newPrice.toFixed(8) },
    );

    logger.info(
      `Instant price change on ${token.symbol}: $${currentPrice.toFixed(4)} → $${newPrice.toFixed(4)} (${(randomized * 100).toFixed(1)}%)`,
    );
  }

  // Instant supply burn
  if (effects.instantSupplyChange !== undefined) {
    const currentSupply = Number(token.availableSupply);
    const magnitude = Math.abs(effects.instantSupplyChange);
    const randomized = magnitude * 0.6 + Math.random() * magnitude * 0.8;
    const burnAmount = Math.floor(currentSupply * randomized);
    const newSupply = Math.max(1, currentSupply - burnAmount);

    await Q.crypto.token.update(
      { id: token.id },
      { availableSupply: BigInt(newSupply) },
    );

    logger.info(
      `Supply shock on ${token.symbol}: burned ${burnAmount.toLocaleString()} tokens (${(randomized * 100).toFixed(1)}%)`,
    );
  }
}

/**
 * Returns the effective effects for an event, handling phase changes
 * (e.g. pump_and_dump flips direction bias halfway through).
 */
function getEffectsForPhase(event: ActiveEvent): EventEffect {
  if (event.type === "pump_and_dump" && event.phaseFlipAt) {
    if (Date.now() >= event.phaseFlipAt) {
      // Phase 2: reverse the direction bias
      return {
        ...event.effects,
        directionBias: event.effects.directionBias
          ? -event.effects.directionBias
          : 0,
      };
    }
  }
  return event.effects;
}

/**
 * Removes events whose activeUntil has passed from the in-memory list,
 * logging each expiry. Iterates in reverse to allow safe splice-in-place.
 *
 * @private
 */
function pruneExpiredEvents(): void {
  const now = Date.now();
  for (let i = activeEvents.length - 1; i >= 0; i--) {
    const event = activeEvents[i];
    if (event.activeUntil && event.activeUntil.getTime() <= now) {
      logger.info(`Market event ended: ${event.type}`);
      activeEvents.splice(i, 1);
    }
  }
}

/**
 * Restores active events from the database on startup.
 * Only loads events whose activeUntil is still in the future.
 */
export async function restoreActiveEvents(): Promise<void> {
  const dbEvents = await getActiveEventsFromDb();

  for (const dbEvent of dbEvents) {
    const eventType = dbEvent.type as MarketEventType;
    if (!EVENT_DEFINITIONS[eventType]) continue;

    // Skip if an event of this type was already restored (keep the newest)
    if (activeEvents.some((e) => e.type === eventType)) continue;

    const meta = dbEvent.metadata as Record<string, unknown> | null;
    const effects =
      (meta?.effects as EventEffect | undefined) ??
      EVENT_DEFINITIONS[eventType].effects;

    const event: ActiveEvent = {
      eventId: dbEvent.id,
      type: eventType,
      activeUntil: dbEvent.activeUntil,
      effects,
      tokenId: dbEvent.tokenId,
      tokenSymbol: (meta?.targetSymbol as string) ?? null,
    };

    if (eventType === "pump_and_dump" && dbEvent.activeUntil) {
      const totalDuration =
        dbEvent.activeUntil.getTime() - dbEvent.createdAt.getTime();
      event.phaseFlipAt = dbEvent.createdAt.getTime() + totalDuration / 2;
    }

    activeEvents.push(event);
  }

  if (activeEvents.length > 0) {
    logger.info(
      `Restored ${activeEvents.length} active market events from database`,
    );
  }
}

/**
 * Fetches all market events from the database that are still within their
 * active window (activeUntil is set and is in the future).
 *
 * @returns Array of active DB event records
 * @private
 */
async function getActiveEventsFromDb() {
  const all = await Q.crypto.market.event
    .where({})
    .orderBy("createdAt", "desc")
    .all();
  const now = new Date();
  return all.filter((e) => e.activeUntil && e.activeUntil > now);
}
