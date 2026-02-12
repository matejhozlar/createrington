import type pg from "pg";
import config from "@/config";

export interface PoolStats {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  maxSize: number;
  utilization: number;
}

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

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

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
