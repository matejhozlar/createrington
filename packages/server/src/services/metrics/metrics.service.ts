import { PlaytimeMetrics } from "./domains/playtime.metrics";
import { EconomyMetrics } from "./domains/economy.metrics";
import { ActivityMetrics } from "./domains/activity.metrics";
import { ModerationMetrics } from "./domains/moderation.metrics";
import { GrowthMetrics } from "./domains/growth.metrics";

/**
 * Aggregate entry point for the five metric domains (playtime, economy, activity,
 * moderation, growth), each lazily constructed on first access. Pure DB layer:
 * no async init, no service-container dependencies; safe to construct eagerly.
 */
export class MetricsService {
  private _playtime?: PlaytimeMetrics;
  private _economy?: EconomyMetrics;
  private _activity?: ActivityMetrics;
  private _moderation?: ModerationMetrics;
  private _growth?: GrowthMetrics;

  /** Playtime metrics: total hours, per-server breakdowns. */
  get playtime(): PlaytimeMetrics {
    if (!this._playtime) {
      this._playtime = new PlaytimeMetrics();
    }
    return this._playtime;
  }

  /** Economy metrics: balance circulation, distribution, transaction volume. */
  get economy(): EconomyMetrics {
    if (!this._economy) {
      this._economy = new EconomyMetrics();
    }
    return this._economy;
  }

  /** Activity metrics: active players, peak concurrent, session length, retention. */
  get activity(): ActivityMetrics {
    if (!this._activity) {
      this._activity = new ActivityMetrics();
    }
    return this._activity;
  }

  /** Moderation metrics: bans, strikes, tickets, moderator leaderboard. */
  get moderation(): ModerationMetrics {
    if (!this._moderation) {
      this._moderation = new ModerationMetrics();
    }
    return this._moderation;
  }

  /** Growth metrics: registrations, waitlist funnel, Discord member trends. */
  get growth(): GrowthMetrics {
    if (!this._growth) {
      this._growth = new GrowthMetrics();
    }
    return this._growth;
  }
}

export const metricsService = new MetricsService();
