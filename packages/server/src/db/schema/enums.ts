import { pgEnum } from "drizzle-orm/pg-core";
import { PLAYER_PROMPT_ENTRY_MODES } from "@createrington/shared/player-prompt";
import {
  WORKSHOP_MOD_EVENT_TYPES,
  WORKSHOP_MOD_REJECT_REASONS,
  WORKSHOP_MOD_STATUSES,
  WORKSHOP_STATUSES,
} from "@createrington/shared/workshop";

export const banTypeEnum = pgEnum("ban_type", ["temporary", "permanent"]);

export const strikeClassificationEnum = pgEnum("strike_classification", [
  "pvp",
  "theft",
  "griefing",
  "laggy_machines",
  "inappropriate_chat",
  "harassment",
  "exploiting",
  "rule_violation",
  "other",
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "closed",
  "deleted",
]);

export const ticketTypeEnum = pgEnum("ticket_type", ["general", "report"]);

export const waitlistStatusEnum = pgEnum("waitlist_status", [
  "pending",
  "auto_accepted",
  "accepted",
  "declined",
  "completed",
]);

export const discordAutoMessageRotationEnum = pgEnum(
  "discord_auto_message_rotation",
  ["sequential", "random"],
);

// Whether a saved Discord message preset holds a classic embed or a Components V2 layout
export const discordEmbedPresetKindEnum = pgEnum("discord_embed_preset_kind", [
  "embed",
  "components",
]);

// Token categories drive price engine behaviour (volatility, floor, demand curve)
export const cryptoTokenCategoryEnum = pgEnum("crypto_token_category", [
  "stable",
  "blue_chip",
  "memecoin",
  "seasonal",
]);

// Direction of an executed trade
export const cryptoTradeTypeEnum = pgEnum("crypto_trade_type", ["buy", "sell"]);

// What caused a trade to execute: market order, a pending order type, or automatic delisting
export const cryptoTradeTriggerEnum = pgEnum("crypto_trade_trigger", [
  "market",
  "limit",
  "stop_loss",
  "take_profit",
  "auto_delist",
]);

// Types of pending (non-market) orders a player can place
export const cryptoOrderTypeEnum = pgEnum("crypto_order_type", [
  "limit_buy",
  "limit_sell",
  "stop_loss",
  "take_profit",
]);

// Lifecycle states for a pending order
export const cryptoOrderStatusEnum = pgEnum("crypto_order_status", [
  "pending",
  "filled",
  "cancelled",
  "expired",
]);

// Time-frame granularity for OHLCV price snapshots
export const cryptoPriceIntervalEnum = pgEnum("crypto_price_interval", [
  "tick",
  "minute",
  "hourly",
  "daily",
  "weekly",
]);

// Whether a price alert fires when the token crosses above or below the target price
export const cryptoAlertDirectionEnum = pgEnum("crypto_alert_direction", [
  "above",
  "below",
]);

// Importance level attached to market events shown in the news feed
export const cryptoEventSeverityEnum = pgEnum("crypto_event_severity", [
  "info",
  "warning",
  "critical",
]);

export const donationTypeEnum = pgEnum("donation_type", [
  "one_time",
  "monthly",
]);

export const playerPromptStatusEnum = pgEnum("player_prompt_status", [
  "active",
  "closed",
]);

// single = one editable answer per player, multi = a player can stack several
// entries, bounded by the prompt's max_entries / cooldown_seconds settings
export const playerPromptEntryModeEnum = pgEnum(
  "player_prompt_entry_mode",
  PLAYER_PROMPT_ENTRY_MODES,
);

export const workshopStatusEnum = pgEnum("workshop_status", WORKSHOP_STATUSES);

// rejected rows persist per workshop with a reason; re-review can approve them
export const workshopModStatusEnum = pgEnum(
  "workshop_mod_status",
  WORKSHOP_MOD_STATUSES,
);

export const workshopModRejectReasonEnum = pgEnum(
  "workshop_mod_reject_reason",
  WORKSHOP_MOD_REJECT_REASONS,
);

export const workshopModEventTypeEnum = pgEnum(
  "workshop_mod_event_type",
  WORKSHOP_MOD_EVENT_TYPES,
);

// How a mod entered the modpack: a suggestion that reached next_update, an
// auto-promoted required dependency, or an unknown mod found in the published
// pack manifest
export const modpackModOriginEnum = pgEnum("modpack_mod_origin", [
  "suggestion",
  "dependency",
  "import",
]);

export const workshopPollStatusEnum = pgEnum("workshop_poll_status", [
  "open",
  "closed",
]);

// per_mod = one yes/no ballot per mod in the poll, bundle = one ballot for the whole poll
export const workshopPollGranularityEnum = pgEnum("workshop_poll_granularity", [
  "per_mod",
  "bundle",
]);
