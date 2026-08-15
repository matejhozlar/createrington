/**
 * Player prompt entry rules, shared so the pg enum, the admin API validator,
 * and the admin UI agree on one set of bounds.
 */

export const PLAYER_PROMPT_ENTRY_MODES = ["single", "multi"] as const;

export type PlayerPromptEntryModeValue =
  (typeof PLAYER_PROMPT_ENTRY_MODES)[number];

/** A capped multi prompt needs at least two entries to be worth the mode. */
export const MIN_ENTRIES_PER_PLAYER = 2;

export const MAX_ENTRIES_PER_PLAYER = 50;

export const MAX_PROMPT_COOLDOWN_SECONDS = 7 * 24 * 60 * 60;
