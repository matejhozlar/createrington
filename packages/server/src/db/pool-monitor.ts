import type pg from "pg";
import config from "@/config";

/** Snapshot of connection pool utilization metrics */
export interface PoolStats {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  maxSize: number;
  /** Pool utilization as a percentage (0-100) */
  utilization: number;
}

/**
 * PostgreSQL connection pool health monitor
 *
 * - Periodically checks pool utilization and warns when thresholds are exceeded
 * - Logs pool lifecycle events (connect, error, remove)
 */
export class PoolMonitor {
  private interval: ReturnType<typeof setInterval> | null = null;
  private readonly pool: pg.Pool;
  private readonly maxSize: number;
  private readonly warnThreshold: number;
  private readonly intervalMs: number;

  constructor(pool: pg.Pool) {
    this.pool = pool;
    this.maxSize = config.database.pool.max;
    this.warnThreshold = config.database.monitoring.warnUtilizationPercent;
    this.intervalMs = config.database.monitoring.intervalMs;
  }

  /** Registers pool event listeners and starts the periodic health check */
  start(): void {
    this.pool.on("connect", () => {
      logger.debug("[Pool] New client connected", this.getStats());
    });

    this.pool.on("error", (err) => {
      logger.error("[Pool] Idle client error", { error: err.message });
    });

    this.pool.on("remove", () => {
      logger.debug("[Pool] Client removed", this.getStats());
    });

    this.interval = setInterval(() => this.checkHealth(), this.intervalMs);
    this.interval.unref();

    logger.info(
      `[Pool] Monitor started (interval=${this.intervalMs}ms, warnAt=${this.warnThreshold}%)`,
    );
  }

  /** Stops the periodic health check */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /** Returns a snapshot of current pool metrics */
  getStats(): PoolStats {
    const utilization =
      this.maxSize > 0
        ? Math.round((this.pool.totalCount / this.maxSize) * 100)
        : 0;

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      maxSize: this.maxSize,
      utilization,
    };
  }

  /** @private Logs warnings when utilization or wait queue thresholds are exceeded */
  private checkHealth(): void {
    const stats = this.getStats();

    if (stats.waitingCount > 0) {
      logger.warn("[Pool] Clients waiting for connections", stats);
    } else if (stats.utilization >= this.warnThreshold) {
      logger.warn(
        `[Pool] High utilization (${stats.utilization}%)`,
        stats,
      );
    } else {
      logger.debug("[Pool] Health check", stats);
    }
  }
}
