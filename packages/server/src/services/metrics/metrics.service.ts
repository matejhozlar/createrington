import { PlaytimeMetrics } from "./domains/playtime.metrics";
import { EconomyMetrics } from "./domains/economy.metrics";
import { ActivityMetrics } from "./domains/activity.metrics";
import { ModerationMetrics } from "./domains/moderation.metrics";
import { GrowthMetrics } from "./domains/growth.metrics";

/**
 * Main Metrics Service
 *
 * Orchestrates all metric domains via lazy-initialized getters:
 * - Playtime: total hours, per-server breakdowns
 * - Economy: balance circulation, distribution, transaction volume
 * - Activity: active players, peak concurrent, session length, retention
 * - Moderation: bans, strikes, tickets, moderator leaderboard
 * - Growth: registrations, waitlist funnel, Discord member trends
 *
 * NOTE: Pure DB layer — no async initialization or service dependencies
 */
export class MetricsService {
  private _playtime?: PlaytimeMetrics;
  private _economy?: EconomyMetrics;
  private _activity?: ActivityMetrics;
  private _moderation?: ModerationMetrics;
  private _growth?: GrowthMetrics;

  /**
   * Playtime metrics domain
   */
  get playtime(): PlaytimeMetrics {
    if (!this._playtime) {
      this._playtime = new PlaytimeMetrics();
    }
    return this._playtime;
  }

  /**
   * Economy metrics domain
   */
  get economy(): EconomyMetrics {
    if (!this._economy) {
      this._economy = new EconomyMetrics();
    }
    return this._economy;
  }

  /**
   * Activity metrics domain
   */
  get activity(): ActivityMetrics {
    if (!this._activity) {
      this._activity = new ActivityMetrics();
    }
    return this._activity;
  }

  /**
   * Moderation metrics domain
   */
  get moderation(): ModerationMetrics {
    if (!this._moderation) {
      this._moderation = new ModerationMetrics();
    }
    return this._moderation;
  }

  /**
   * Growth metrics domain
   */
  get growth(): GrowthMetrics {
    if (!this._growth) {
      this._growth = new GrowthMetrics();
    }
    return this._growth;
  }
}

export const metricsService = new MetricsService();
