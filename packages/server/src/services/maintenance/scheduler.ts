import { Q } from "@/db";
import { Discord } from "@/discord/constants";
import type { DiscordMessageService } from "@/services/discord/message/message.service";
import type { ServerMaintenanceSchedule } from "@createrington/shared/db/server_maintenance_schedule.types";
import type { MaintenanceService } from "./maintenance.service";

const WARNING_INTERVALS_MINUTES = [60, 30, 15, 10, 5, 1] as const;
const MISSED_ACTIVATION_GRACE_MS = 5 * 60 * 1000;

/**
 * Maintenance Scheduler
 *
 * Owns the `server_maintenance_schedule` rows: one per window, moving through
 * scheduled → active → completed | cancelled. For scheduled windows it arms
 * setTimeout handles that post Discord warnings at fixed intervals and hand
 * the window to MaintenanceService.apply at the start time; instant windows
 * are created directly as active. Restores pending windows on startup,
 * activating ones missed by less than five minutes and cancelling older ones.
 * Keeps an in-memory copy of each server's scheduled or active row so status
 * reads never hit the database.
 */
export class MaintenanceScheduler {
  private warningTimers = new Map<number, NodeJS.Timeout[]>();
  private activationTimers = new Map<number, NodeJS.Timeout>();
  private windows = new Map<number, ServerMaintenanceSchedule>();

  constructor(
    private maintenanceService: MaintenanceService,
    private messageService: DiscordMessageService,
  ) {}

  /** Load active and pending windows from the database and arm their timers. */
  async initialize(): Promise<void> {
    const active = await Q.server.maintenance.schedule.findAll({
      status: "active",
    });
    for (const window of active) {
      this.windows.set(window.serverId, window);
    }

    const pending = await Q.server.maintenance.schedule.findAll({
      status: "scheduled",
    });

    for (const schedule of pending) {
      if (this.windows.has(schedule.serverId)) {
        logger.warn(
          `Scheduled maintenance #${schedule.id} conflicts with an active window on server ${schedule.serverId}, cancelling it`,
        );
        await this.setStatus(schedule.id, "cancelled");
        continue;
      }

      const msUntil = schedule.scheduledAt.getTime() - Date.now();

      if (msUntil > 0) {
        this.windows.set(schedule.serverId, schedule);
        this.setupTimers(schedule);
        logger.info(
          `Restored scheduled maintenance #${schedule.id} for server ${schedule.serverId} ` +
            `(starts in ${Math.round(msUntil / 60000)} min)`,
        );
      } else if (msUntil > -MISSED_ACTIVATION_GRACE_MS) {
        logger.warn(
          `Scheduled maintenance #${schedule.id} was missed by ${Math.round(-msUntil / 1000)}s, activating now`,
        );
        this.windows.set(schedule.serverId, schedule);
        await this.activateMaintenance(schedule);
      } else {
        logger.warn(
          `Scheduled maintenance #${schedule.id} was missed by ${Math.round(-msUntil / 60000)} min, cancelling`,
        );
        await this.setStatus(schedule.id, "cancelled");
      }
    }
  }

  /** Persist a future window and arm its warning and activation timers. */
  async schedule(opts: {
    serverId: number;
    scheduledAt: Date;
    estimatedMinutes: number;
    scheduledByDiscordId: string;
  }): Promise<ServerMaintenanceSchedule> {
    const row = await Q.server.maintenance.schedule.createAndReturn({
      serverId: opts.serverId,
      scheduledAt: opts.scheduledAt,
      estimatedMinutes: opts.estimatedMinutes,
      scheduledByDiscordId: opts.scheduledByDiscordId,
      status: "scheduled",
    });

    this.windows.set(opts.serverId, row);
    this.setupTimers(row);

    logger.info(
      `Scheduled maintenance #${row.id} for server ${opts.serverId} at ${opts.scheduledAt.toISOString()} ` +
        `(${opts.estimatedMinutes} min)`,
    );

    return row;
  }

  /** Persist an instant window as active; the caller pushes it to the mod. */
  async startNow(opts: {
    serverId: number;
    scheduledByDiscordId: string;
    untilRestart: boolean;
  }): Promise<ServerMaintenanceSchedule> {
    const now = new Date();
    const row = await Q.server.maintenance.schedule.createAndReturn({
      serverId: opts.serverId,
      scheduledAt: now,
      startedAt: now,
      estimatedMinutes: null,
      untilRestart: opts.untilRestart,
      scheduledByDiscordId: opts.scheduledByDiscordId,
      status: "active",
    });

    this.windows.set(opts.serverId, row);
    logger.info(
      `Started maintenance #${row.id} for server ${opts.serverId}${opts.untilRestart ? " (until restart)" : ""}`,
    );
    return row;
  }

  /** Cancel a pending window; active windows are left alone. */
  async cancel(serverId: number): Promise<void> {
    const schedule = this.windows.get(serverId);
    if (!schedule || schedule.status !== "scheduled") return;

    this.clearTimers(schedule.id);
    this.windows.delete(serverId);
    await this.setStatus(schedule.id, "cancelled");

    logger.info(
      `Cancelled scheduled maintenance #${schedule.id} for server ${serverId}`,
    );
  }

  /** Cancel the server's open window whatever its status, for windows that never reached the mod. */
  async discard(serverId: number): Promise<void> {
    const schedule = this.windows.get(serverId);
    if (!schedule) return;

    this.clearTimers(schedule.id);
    this.windows.delete(serverId);
    await this.setStatus(schedule.id, "cancelled");

    logger.info(
      `Discarded maintenance #${schedule.id} for server ${serverId} (never applied)`,
    );
  }

  /** The scheduled or active window for a server, or null. */
  getSchedule(serverId: number): ServerMaintenanceSchedule | null {
    return this.windows.get(serverId) ?? null;
  }

  /** Record that the mod confirmed the window. */
  async markApplied(scheduleId: number): Promise<void> {
    const updated = await Q.server.maintenance.schedule.updateAndReturn(
      { id: scheduleId },
      { appliedAt: new Date(), updatedAt: new Date() },
    );
    if (this.windows.get(updated.serverId)?.id === scheduleId) {
      this.windows.set(updated.serverId, updated);
    }
  }

  /** Complete the server's active window. */
  async markCompleted(serverId: number): Promise<void> {
    const schedule = this.windows.get(serverId);
    if (!schedule) return;

    this.clearTimers(schedule.id);
    this.windows.delete(serverId);

    await Q.server.maintenance.schedule.update(
      { id: schedule.id },
      { status: "completed", endedAt: new Date(), updatedAt: new Date() },
    );

    logger.info(
      `Marked maintenance #${schedule.id} as completed for server ${serverId}`,
    );
  }

  /** Clear every timer; the database keeps the windows for the next boot. */
  shutdown(): void {
    for (const [scheduleId] of this.warningTimers) {
      this.clearTimers(scheduleId);
    }
    for (const [scheduleId] of this.activationTimers) {
      this.clearTimers(scheduleId);
    }
    this.windows.clear();
  }

  private async setStatus(
    scheduleId: number,
    status: "cancelled" | "completed",
  ): Promise<void> {
    await Q.server.maintenance.schedule.update(
      { id: scheduleId },
      { status, updatedAt: new Date() },
    );
  }

  private setupTimers(schedule: ServerMaintenanceSchedule): void {
    const timers: NodeJS.Timeout[] = [];
    const scheduledMs = schedule.scheduledAt.getTime();

    for (const minutes of WARNING_INTERVALS_MINUTES) {
      const delay = scheduledMs - minutes * 60 * 1000 - Date.now();
      if (delay <= 0) continue;

      timers.push(
        setTimeout(() => {
          this.sendWarning(schedule, minutes).catch((err) =>
            logger.error(
              `Failed to send ${minutes}min warning for maintenance #${schedule.id}: ${err}`,
            ),
          );
        }, delay),
      );
    }

    this.warningTimers.set(schedule.id, timers);

    const activationDelay = scheduledMs - Date.now();
    if (activationDelay > 0) {
      const timer = setTimeout(() => {
        this.activateMaintenance(schedule).catch((err) =>
          logger.error(
            `Failed to activate maintenance #${schedule.id}: ${err}`,
          ),
        );
      }, activationDelay);
      this.activationTimers.set(schedule.id, timer);
    }
  }

  private clearTimers(scheduleId: number): void {
    const warnings = this.warningTimers.get(scheduleId);
    if (warnings) {
      for (const timer of warnings) clearTimeout(timer);
      this.warningTimers.delete(scheduleId);
    }

    const activation = this.activationTimers.get(scheduleId);
    if (activation) {
      clearTimeout(activation);
      this.activationTimers.delete(scheduleId);
    }
  }

  private async sendWarning(
    schedule: ServerMaintenanceSchedule,
    minutesBefore: number,
  ): Promise<void> {
    const label =
      minutesBefore >= 60
        ? `${Math.floor(minutesBefore / 60)} hour${minutesBefore >= 120 ? "s" : ""}`
        : `${minutesBefore} minute${minutesBefore !== 1 ? "s" : ""}`;

    const result = await this.messageService.send({
      channelId: Discord.Channels.cogsAndSteam.MINECRAFT_CHAT,
      content: `Server maintenance in ${label}. Players will be kicked when maintenance begins.`,
    });

    if (result.success) {
      logger.info(
        `Sent ${minutesBefore}min maintenance warning for schedule #${schedule.id}`,
      );
    } else {
      logger.error(`Failed to send maintenance warning: ${result.error}`);
    }
  }

  private async activateMaintenance(
    schedule: ServerMaintenanceSchedule,
  ): Promise<void> {
    this.clearTimers(schedule.id);

    const updated = await Q.server.maintenance.schedule.updateAndReturn(
      { id: schedule.id },
      { status: "active", startedAt: new Date(), updatedAt: new Date() },
    );
    this.windows.set(schedule.serverId, updated);

    const result = await this.maintenanceService.apply(updated);
    if (result.applied) {
      logger.info(
        `Scheduled maintenance #${schedule.id} for server ${schedule.serverId} is active`,
      );
    } else if (result.modError) {
      logger.error(
        `Scheduled maintenance #${schedule.id} for server ${schedule.serverId} is pending: the mod refused it and reconcile will keep retrying`,
      );
    } else {
      logger.info(
        `Scheduled maintenance #${schedule.id} for server ${schedule.serverId} is pending until the server is reachable`,
      );
    }
  }
}
