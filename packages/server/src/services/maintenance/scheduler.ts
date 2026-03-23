import { Q } from "@/db";
import { Discord } from "@/discord/constants";
import { getService, Services } from "@/services";
import type { DiscordMessageService } from "@/services/discord/message/message.service";
import type { ServerMaintenanceSchedule } from "@createrington/shared/db/server_maintenance_schedule.types";
import type { MaintenanceService } from "./index";

const WARNING_INTERVALS_MINUTES = [60, 30, 15, 10, 5, 1] as const;

/**
 * Maintenance Scheduler
 *
 * Manages scheduled maintenance windows: persists to DB, sets up warning
 * timers that send Discord messages at defined intervals, and auto-enables
 * maintenance mode when the scheduled time arrives.
 *
 * Follows the setTimeout pattern used by DailyRoleScheduler and AutoMessageService.
 */
export class MaintenanceScheduler {
  /** scheduleId → array of warning setTimeout handles */
  private warningTimers = new Map<number, NodeJS.Timeout[]>();
  /** scheduleId → activation setTimeout handle */
  private activationTimers = new Map<number, NodeJS.Timeout>();
  /** serverId → cached schedule row (only scheduled/active) */
  private activeSchedules = new Map<number, ServerMaintenanceSchedule>();

  constructor(
    private maintenanceService: MaintenanceService,
    private messageService: DiscordMessageService,
  ) {}

  /**
   * Load pending schedules from DB and set up timers.
   * Called once on server startup.
   */
  async initialize(): Promise<void> {
    const pending = await Q.server.maintenance.schedule.findAll({
      status: "scheduled",
    });

    for (const schedule of pending) {
      const msUntil = schedule.scheduledAt.getTime() - Date.now();

      if (msUntil > 0) {
        this.activeSchedules.set(schedule.serverId, schedule);
        this.setupTimers(schedule);
        logger.info(
          `Restored scheduled maintenance #${schedule.id} for server ${schedule.serverId} ` +
            `(starts in ${Math.round(msUntil / 60000)} min)`,
        );
      } else if (msUntil > -5 * 60 * 1000) {
        // Missed by less than 5 minutes — activate immediately
        logger.warn(
          `Scheduled maintenance #${schedule.id} was missed by ${Math.round(-msUntil / 1000)}s — activating now`,
        );
        this.activeSchedules.set(schedule.serverId, schedule);
        await this.activateMaintenance(schedule);
      } else {
        // Missed by more than 5 minutes — cancel
        logger.warn(
          `Scheduled maintenance #${schedule.id} was missed by ${Math.round(-msUntil / 60000)} min — cancelling`,
        );
        await Q.server.maintenance.schedule.update(
          { id: schedule.id },
          { status: "cancelled" },
        );
      }
    }

    // Also cache any currently active maintenance rows
    const active = await Q.server.maintenance.schedule.findAll({
      status: "active",
    });
    for (const schedule of active) {
      this.activeSchedules.set(schedule.serverId, schedule);
    }
  }

  /**
   * Schedule a new maintenance window.
   */
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

    this.activeSchedules.set(opts.serverId, row);
    this.setupTimers(row);

    logger.info(
      `Scheduled maintenance #${row.id} for server ${opts.serverId} at ${opts.scheduledAt.toISOString()} ` +
        `(${opts.estimatedMinutes} min)`,
    );

    return row;
  }

  /**
   * Cancel a pending schedule for a server.
   */
  async cancel(serverId: number): Promise<void> {
    const schedule = this.activeSchedules.get(serverId);
    if (!schedule || schedule.status !== "scheduled") return;

    this.clearTimers(schedule.id);
    this.activeSchedules.delete(serverId);

    await Q.server.maintenance.schedule.update(
      { id: schedule.id },
      { status: "cancelled" },
    );

    logger.info(
      `Cancelled scheduled maintenance #${schedule.id} for server ${serverId}`,
    );
  }

  /**
   * Return the current scheduled/active maintenance for a server, or null.
   */
  getSchedule(serverId: number): ServerMaintenanceSchedule | null {
    return this.activeSchedules.get(serverId) ?? null;
  }

  /**
   * Mark active maintenance as completed (called when admin disables maintenance).
   */
  async markCompleted(serverId: number): Promise<void> {
    const schedule = this.activeSchedules.get(serverId);
    if (!schedule) return;

    this.clearTimers(schedule.id);
    this.activeSchedules.delete(serverId);

    await Q.server.maintenance.schedule.update(
      { id: schedule.id },
      { status: "completed", endedAt: new Date() },
    );

    logger.info(
      `Marked maintenance #${schedule.id} as completed for server ${serverId}`,
    );
  }

  /**
   * Clean up all timers on shutdown.
   */
  shutdown(): void {
    for (const [scheduleId] of this.warningTimers) {
      this.clearTimers(scheduleId);
    }
    for (const [scheduleId] of this.activationTimers) {
      this.clearTimers(scheduleId);
    }
    this.activeSchedules.clear();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Creates warning and activation setTimeout handles for a schedule row.
   * Warning timers fire at each interval in WARNING_INTERVALS_MINUTES that
   * still lies in the future; the activation timer fires at the exact start time.
   *
   * @param schedule - The persisted schedule row to set up timers for
   * @private
   */
  private setupTimers(schedule: ServerMaintenanceSchedule): void {
    const timers: NodeJS.Timeout[] = [];
    const scheduledMs = schedule.scheduledAt.getTime();

    // Warning timers
    for (const minutes of WARNING_INTERVALS_MINUTES) {
      const warningMs = scheduledMs - minutes * 60 * 1000;
      const delay = warningMs - Date.now();

      if (delay > 0) {
        const timer = setTimeout(() => {
          this.sendWarning(schedule, minutes).catch((err) =>
            logger.error(
              `Failed to send ${minutes}min warning for maintenance #${schedule.id}: ${err}`,
            ),
          );
        }, delay);
        timers.push(timer);
      }
    }

    this.warningTimers.set(schedule.id, timers);

    // Activation timer
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

  /**
   * Clears all warning and activation timers associated with a schedule.
   *
   * @param scheduleId - ID of the schedule whose timers should be cleared
   * @private
   */
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

  /**
   * Sends a plain-text warning message to the Minecraft chat channel
   * indicating how long until maintenance begins.
   *
   * @param schedule - The schedule row the warning is for
   * @param minutesBefore - How many minutes before start the warning fires
   * @private
   */
  private async sendWarning(
    schedule: ServerMaintenanceSchedule,
    minutesBefore: number,
  ): Promise<void> {
    const label =
      minutesBefore >= 60
        ? `${Math.floor(minutesBefore / 60)} hour${minutesBefore >= 120 ? "s" : ""}`
        : `${minutesBefore} minute${minutesBefore !== 1 ? "s" : ""}`;

    const message = `⚠️ Server maintenance in ${label}. Players will be kicked when maintenance begins.`;

    const result = await this.messageService.send({
      channelId: Discord.Channels.cogsAndSteam.MINECRAFT_CHAT,
      content: message,
    });

    if (result.success) {
      logger.info(
        `Sent ${minutesBefore}min maintenance warning for schedule #${schedule.id}`,
      );
    } else {
      logger.error(
        `Failed to send maintenance warning: ${result.error}`,
      );
    }
  }

  /**
   * Activates maintenance mode for the given schedule:
   * 1. Kicks online players and enables the whitelist swap via MaintenanceService
   * 2. Updates the DB row to status "active" with a startedAt timestamp
   * 3. Broadcasts a server status update over WebSocket
   *
   * @param schedule - The schedule row to activate
   * @private
   */
  private async activateMaintenance(
    schedule: ServerMaintenanceSchedule,
  ): Promise<void> {
    this.clearTimers(schedule.id);

    try {
      // Get online players to kick
      const manager = await getService(Services.PLAYTIME_MANAGER_SERVICE);
      const service = manager.getService(schedule.serverId);
      const onlinePlayers = (service?.getActiveSessions() ?? []).map(
        (s) => s.username,
      );

      await this.maintenanceService.enable(schedule.serverId, onlinePlayers);

      // Update DB row
      const updated = await Q.server.maintenance.schedule.updateAndReturn(
        { id: schedule.id },
        { status: "active", startedAt: new Date() },
      );
      if (updated) {
        this.activeSchedules.set(schedule.serverId, updated);
      }

      // Broadcast via WebSocket
      try {
        const ws = await getService(Services.WEBSOCKET_SERVICE);
        await ws.triggerServerStatusUpdate(schedule.serverId);
      } catch {
        // Non-critical
      }

      logger.info(
        `Auto-activated maintenance #${schedule.id} for server ${schedule.serverId}`,
      );
    } catch (err) {
      logger.error(
        `Failed to auto-activate maintenance #${schedule.id}: ${err}`,
      );
    }
  }
}
