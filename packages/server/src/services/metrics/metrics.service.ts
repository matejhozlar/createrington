import { PlaytimeMetrics } from "./domains/playtime.metrics";

/**
 * Main Metrics Service
 *
 * Orchestrates all metric domains
 * Pure DB layer - no initialization required
 * Exported as singleton
 */
export class MetricsService {
  private _playtime?: PlaytimeMetrics;

  /**
   * Playtime metrics domain
   */
  get playtime(): PlaytimeMetrics {
    if (!this._playtime) {
      this._playtime = new PlaytimeMetrics();
    }
    return this._playtime;
  }
}

export const metricsService = new MetricsService();
