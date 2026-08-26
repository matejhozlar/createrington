import { Q } from "@/db";
import { getService, Services } from "@/services";
import { getServerById } from "@/services/playtime/config";
import type { ServerMaintenanceSchedule } from "@createrington/shared/db/server_maintenance_schedule.types";
import { MaintenanceModeClient } from "./mmode";
import {
  MAINTENANCE_MESSAGE_PRESET,
  MAINTENANCE_MOTD_PRESET,
  renderMaintenanceTemplate,
} from "./presets";
import type { MaintenanceScheduler } from "./scheduler";

const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;

export interface MaintenanceStatus {
  enabled: boolean;
  modEnabled: boolean | null;
  observedAt: Date | null;
  pendingApply: boolean;
  schedule: ServerMaintenanceSchedule | null;
}

export interface MaintenanceAllowedPlayer {
  uuid: string;
  username: string;
  source: "admin" | "manual";
  addedByDiscordId: string | null;
}

export interface MaintenanceSettings {
  motd: string | null;
  message: string | null;
  presets: { motd: string; message: string };
  allowedPlayers: MaintenanceAllowedPlayer[];
}

export interface AllowListSyncResult {
  added: string[];
  removed: string[];
}

interface ModState {
  enabled: boolean | null;
  observedAt: Date | null;
}

/**
 * Maintenance Mode Service
 *
 * Drives the Maintenance Mode mod on each game server over RCON. The mod's
 * own state (persisted in its mmode.json) is the truth for whether players
 * are being gated right now; this service keeps the last observed value per
 * server and only ever changes it through the mod's commands. The database
 * holds the intent and the history: a `server_maintenance_schedule` row per
 * window (scheduled, instant, or discovered running), plus the presentation
 * settings and allow list the mod is synced against.
 *
 * A window that is active in the database but not yet confirmed by the mod
 * (`applied_at` NULL, e.g. the server was down when it started) is pushed by
 * `reconcile`, which runs at boot, whenever the playtime service reports the
 * server online, on a slow interval, and after every mutation. Reconcile
 * also mirrors changes made outside the app (`/maintenance off` in-game,
 * `untilRestart` firing) back into the database. Disabling is always explicit;
 * reconcile never turns maintenance off on its own.
 */
export class MaintenanceService {
  private modState = new Map<number, ModState>();
  private scheduler: MaintenanceScheduler | null = null;
  private reconcileTimer: NodeJS.Timeout | null = null;
  private reconciling = new Set<number>();
  private serverIds: number[] = [];

  constructor(
    private readonly mmode: MaintenanceModeClient = new MaintenanceModeClient(),
  ) {}

  /** Wire the scheduler after both are constructed (avoids a circular import). */
  setScheduler(scheduler: MaintenanceScheduler): void {
    this.scheduler = scheduler;
  }

  /** Subscribe to server online events, run the first reconcile, and start the periodic one. */
  async initialize(serverIds: number[]): Promise<void> {
    this.serverIds = serverIds;

    try {
      const manager = await getService(Services.PLAYTIME_MANAGER_SERVICE);
      for (const serverId of serverIds) {
        manager.getService(serverId)?.on("serverOnline", () => {
          this.onServerOnline(serverId).catch((error) =>
            logger.warn(
              `Maintenance sync after server ${serverId} came online failed: ${error}`,
            ),
          );
        });
      }
    } catch (error) {
      logger.warn(
        `Maintenance service could not subscribe to server online events: ${error}`,
      );
    }

    this.reconcileTimer = setInterval(() => {
      for (const serverId of this.serverIds) {
        this.reconcile(serverId).catch((error) =>
          logger.warn(
            `Periodic maintenance reconcile for server ${serverId} failed: ${error}`,
          ),
        );
      }
    }, RECONCILE_INTERVAL_MS);

    await Promise.all(
      serverIds.map((serverId) =>
        this.reconcile(serverId).catch((error) =>
          logger.warn(
            `Initial maintenance reconcile for server ${serverId} failed: ${error}`,
          ),
        ),
      ),
    );
  }

  /** Stop the periodic reconcile and the scheduler's timers. */
  shutdown(): void {
    if (this.reconcileTimer) {
      clearInterval(this.reconcileTimer);
      this.reconcileTimer = null;
    }
    this.scheduler?.shutdown();
  }

  /** Whether players are (or are meant to be) gated on the server right now. */
  isInMaintenance(serverId: number): boolean {
    return (
      this.modState.get(serverId)?.enabled === true ||
      this.getActiveWindow(serverId) !== null
    );
  }

  /** Effective state plus the scheduled or active window, for status endpoints. */
  getStatus(serverId: number): MaintenanceStatus {
    const state = this.modState.get(serverId);
    const window = this.getActiveWindow(serverId);
    return {
      enabled: this.isInMaintenance(serverId),
      modEnabled: state?.enabled ?? null,
      observedAt: state?.observedAt ?? null,
      pendingApply: window !== null && window.appliedAt === null,
      schedule: this.getScheduledMaintenance(serverId),
    };
  }

  /** The scheduled or active window for a server, or null. */
  getScheduledMaintenance(serverId: number): ServerMaintenanceSchedule | null {
    return this.scheduler?.getSchedule(serverId) ?? null;
  }

  /** Schedule a future window; warnings and activation are handled by the scheduler. */
  async scheduleMaintenance(opts: {
    serverId: number;
    scheduledAt: Date;
    estimatedMinutes: number;
    scheduledByDiscordId: string;
  }): Promise<ServerMaintenanceSchedule> {
    return this.requireScheduler().schedule(opts);
  }

  /** Cancel a pending (not yet active) window. */
  async cancelScheduledMaintenance(serverId: number): Promise<void> {
    await this.requireScheduler().cancel(serverId);
  }

  /**
   * Start maintenance now. Returns `applied: false` when the game server could
   * not be reached; the window stays active and is pushed once it is back.
   */
  async enable(
    serverId: number,
    opts: { byDiscordId: string; untilRestart?: boolean },
  ): Promise<{ applied: boolean }> {
    if (this.isInMaintenance(serverId)) {
      throw new Error(`Server ${serverId} is already in maintenance mode`);
    }

    const scheduler = this.requireScheduler();
    const pending = scheduler.getSchedule(serverId);
    if (pending?.status === "scheduled") {
      await scheduler.cancel(serverId);
    }

    const window = await scheduler.startNow({
      serverId,
      scheduledByDiscordId: opts.byDiscordId,
      untilRestart: opts.untilRestart ?? false,
    });

    return this.apply(window);
  }

  /**
   * Push an active window to the mod: sync presentation and allow list, then
   * turn maintenance on. Marks the window applied on success.
   */
  async apply(
    window: ServerMaintenanceSchedule,
  ): Promise<{ applied: boolean }> {
    const { serverId } = window;
    try {
      await this.pushSettings(serverId, window);
      await this.mmode.enable(serverId, { untilRestart: window.untilRestart });
    } catch (error) {
      logger.warn(
        `Maintenance #${window.id} could not be applied on server ${serverId}, will retry when the server is reachable: ${error}`,
      );
      this.setModState(serverId, null);
      await this.broadcast(serverId);
      return { applied: false };
    }

    await this.requireScheduler().markApplied(window.id);
    this.setModState(serverId, true);
    await this.broadcast(serverId);
    logger.info(`Maintenance #${window.id} applied on server ${serverId}`);
    return { applied: true };
  }

  /** Turn maintenance off on the mod and complete the active window. */
  async disable(serverId: number): Promise<void> {
    const window = this.getActiveWindow(serverId);
    if (!window && this.modState.get(serverId)?.enabled !== true) {
      throw new Error(`Server ${serverId} is not in maintenance mode`);
    }

    try {
      await this.mmode.disable(serverId);
    } catch (error) {
      if (!window || window.appliedAt !== null) throw error;
      logger.warn(
        `Server ${serverId} is unreachable; closing the never-applied maintenance #${window.id} without contacting the mod`,
      );
    }

    this.setModState(serverId, false);
    if (window) {
      await this.requireScheduler().markCompleted(serverId);
    }
    await this.broadcast(serverId);
    logger.info(`Maintenance mode disabled for server ${serverId}`);
  }

  /**
   * Read the mod's state and settle any difference with the database: push a
   * window the mod has not confirmed yet, or complete a window the mod has
   * already left. Skipped while another reconcile for the server is running.
   */
  async reconcile(serverId: number): Promise<void> {
    if (this.reconciling.has(serverId)) return;
    this.reconciling.add(serverId);

    try {
      const before = this.isInMaintenance(serverId);

      let modEnabled: boolean;
      try {
        modEnabled = await this.mmode.status(serverId);
      } catch (error) {
        this.setModState(serverId, null);
        logger.debug(
          `Maintenance status for server ${serverId} unavailable: ${error}`,
        );
        if (before !== this.isInMaintenance(serverId)) {
          await this.broadcast(serverId);
        }
        return;
      }

      this.setModState(serverId, modEnabled);
      const window = this.getActiveWindow(serverId);

      if (window && !modEnabled) {
        if (window.appliedAt === null) {
          await this.apply(window);
          return;
        }
        logger.info(
          `Maintenance #${window.id} was turned off outside the app, marking it completed`,
        );
        await this.requireScheduler().markCompleted(serverId);
      } else if (window && modEnabled && window.appliedAt === null) {
        await this.requireScheduler().markApplied(window.id);
      }

      if (before !== this.isInMaintenance(serverId)) {
        await this.broadcast(serverId);
      }
    } finally {
      this.reconciling.delete(serverId);
    }
  }

  /** Presentation settings and the resolved allow list for a server. */
  async getSettings(serverId: number): Promise<MaintenanceSettings> {
    const [row, allowedPlayers] = await Promise.all([
      this.findSettingRow(serverId),
      this.resolveAllowedPlayers(serverId),
    ]);
    return {
      motd: row?.motd ?? null,
      message: row?.message ?? null,
      presets: {
        motd: MAINTENANCE_MOTD_PRESET,
        message: MAINTENANCE_MESSAGE_PRESET,
      },
      allowedPlayers,
    };
  }

  /**
   * Store MOTD / kick message overrides (null restores the preset) and push
   * them to the mod. Returns whether the push reached the server.
   */
  async updateSettings(
    serverId: number,
    patch: { motd?: string | null; message?: string | null },
    byDiscordId: string,
  ): Promise<{ pushed: boolean }> {
    const existing = await this.findSettingRow(serverId);
    await Q.server.maintenance.setting.upsert(
      {
        serverId,
        motd: patch.motd !== undefined ? patch.motd : (existing?.motd ?? null),
        message:
          patch.message !== undefined
            ? patch.message
            : (existing?.message ?? null),
        updatedByDiscordId: byDiscordId,
        updatedAt: new Date(),
      },
      "serverId",
      ["motd", "message", "updatedByDiscordId", "updatedAt"],
    );

    return { pushed: await this.tryPush(serverId, "presentation") };
  }

  /** Allow a registered player to join during maintenance and push it to the mod. */
  async addAllowedPlayer(
    serverId: number,
    playerUuid: string,
    byDiscordId: string,
  ): Promise<{ username: string; pushed: boolean }> {
    const player = await Q.player.find({ minecraftUuid: playerUuid });
    if (!player) {
      throw new Error("Player is not registered");
    }

    const exists = await Q.server.maintenance.allowed.player.exists({
      serverId,
      playerUuid,
    });
    if (!exists) {
      await Q.server.maintenance.allowed.player.create({
        serverId,
        playerUuid,
        addedByDiscordId: byDiscordId,
      });
    }

    let pushed = true;
    try {
      await this.mmode.addAllowed(serverId, player.minecraftUsername);
    } catch (error) {
      pushed = false;
      logger.warn(
        `Could not push ${player.minecraftUsername} to the maintenance allow list on server ${serverId}: ${error}`,
      );
    }
    return { username: player.minecraftUsername, pushed };
  }

  /** Remove a manually allowed player; admins cannot be removed. */
  async removeAllowedPlayer(
    serverId: number,
    playerUuid: string,
  ): Promise<{ username: string; pushed: boolean }> {
    const allowed = await this.resolveAllowedPlayers(serverId);
    const entry = allowed.find((p) => p.uuid === playerUuid);
    if (!entry) {
      throw new Error("Player is not on the allow list");
    }
    if (entry.source === "admin") {
      throw new Error("Admins are always allowed and cannot be removed");
    }

    await Q.server.maintenance.allowed.player.delete({ serverId, playerUuid });

    let pushed = true;
    try {
      await this.mmode.removeAllowed(serverId, entry.username);
    } catch (error) {
      pushed = false;
      logger.warn(
        `Could not remove ${entry.username} from the maintenance allow list on server ${serverId}: ${error}`,
      );
    }
    return { username: entry.username, pushed };
  }

  /** Push presentation, backup-off, and the allow list to the mod. Throws if the server is unreachable. */
  async pushSettings(
    serverId: number,
    window: ServerMaintenanceSchedule | null = this.getActiveWindow(serverId),
  ): Promise<AllowListSyncResult> {
    await this.pushPresentation(serverId, window);
    await this.mmode.setBackups(serverId, false);
    return this.syncAllowList(serverId);
  }

  /** Bring the mod's allow list in line with admins plus the manual list. */
  async syncAllowList(serverId: number): Promise<AllowListSyncResult> {
    const desired = await this.resolveAllowedPlayers(serverId);
    const current = await this.mmode.list(serverId);

    const desiredNames = new Set(desired.map((p) => p.username.toLowerCase()));
    const currentNames = new Set(current.players.map((n) => n.toLowerCase()));

    const added: string[] = [];
    for (const player of desired) {
      if (currentNames.has(player.username.toLowerCase())) continue;
      try {
        await this.mmode.addAllowed(serverId, player.username);
        added.push(player.username);
      } catch (error) {
        logger.warn(
          `Could not allow ${player.username} on server ${serverId}: ${error}`,
        );
      }
    }

    const removed: string[] = [];
    for (const name of current.players) {
      if (desiredNames.has(name.toLowerCase())) continue;
      await this.mmode.removeAllowed(serverId, name);
      removed.push(name);
    }

    if (added.length > 0 || removed.length > 0) {
      logger.info(
        `Maintenance allow list synced on server ${serverId} (+${added.length} / -${removed.length})`,
      );
    }
    return { added, removed };
  }

  private async pushPresentation(
    serverId: number,
    window: ServerMaintenanceSchedule | null,
  ): Promise<void> {
    const row = await this.findSettingRow(serverId);
    const context = {
      server: getServerById(serverId)?.name ?? "The server",
      estimatedMinutes: window?.estimatedMinutes ?? null,
    };
    await this.mmode.setMotd(
      serverId,
      renderMaintenanceTemplate(row?.motd ?? MAINTENANCE_MOTD_PRESET, context),
    );
    await this.mmode.setMessage(
      serverId,
      renderMaintenanceTemplate(
        row?.message ?? MAINTENANCE_MESSAGE_PRESET,
        context,
      ),
    );
  }

  private async tryPush(
    serverId: number,
    scope: "presentation" | "all",
  ): Promise<boolean> {
    try {
      if (scope === "presentation") {
        await this.pushPresentation(serverId, this.getActiveWindow(serverId));
      } else {
        await this.pushSettings(serverId);
      }
      return true;
    } catch (error) {
      logger.warn(
        `Maintenance settings could not be pushed to server ${serverId}: ${error}`,
      );
      return false;
    }
  }

  private async resolveAllowedPlayers(
    serverId: number,
  ): Promise<MaintenanceAllowedPlayer[]> {
    const [admins, manual] = await Promise.all([
      Q.admin.findAll(),
      Q.server.maintenance.allowed.player.findAll({ serverId }),
    ]);

    const adminIds = admins.map((a) => a.discordId);
    const manualUuids = manual.map((m) => m.playerUuid);
    const [adminPlayers, manualPlayers] = await Promise.all([
      adminIds.length > 0
        ? Q.player.findAll({ discordId: { $in: adminIds } })
        : [],
      manualUuids.length > 0
        ? Q.player.findAll({ minecraftUuid: { $in: manualUuids } })
        : [],
    ]);

    const result = new Map<string, MaintenanceAllowedPlayer>();
    for (const player of adminPlayers) {
      result.set(player.minecraftUuid, {
        uuid: player.minecraftUuid,
        username: player.minecraftUsername,
        source: "admin",
        addedByDiscordId: null,
      });
    }
    for (const entry of manual) {
      if (result.has(entry.playerUuid)) continue;
      const player = manualPlayers.find(
        (p) => p.minecraftUuid === entry.playerUuid,
      );
      if (!player) continue;
      result.set(player.minecraftUuid, {
        uuid: player.minecraftUuid,
        username: player.minecraftUsername,
        source: "manual",
        addedByDiscordId: entry.addedByDiscordId,
      });
    }

    return [...result.values()].sort((a, b) =>
      a.username.localeCompare(b.username),
    );
  }

  private async findSettingRow(serverId: number) {
    return Q.server.maintenance.setting.find({ serverId });
  }

  private async onServerOnline(serverId: number): Promise<void> {
    logger.info(
      `Server ${serverId} is online, syncing maintenance settings and state`,
    );
    await this.tryPush(serverId, "all");
    await this.reconcile(serverId);
  }

  private getActiveWindow(serverId: number): ServerMaintenanceSchedule | null {
    const schedule = this.scheduler?.getSchedule(serverId) ?? null;
    return schedule?.status === "active" ? schedule : null;
  }

  private setModState(serverId: number, enabled: boolean | null): void {
    this.modState.set(serverId, {
      enabled,
      observedAt: enabled === null ? null : new Date(),
    });
  }

  private requireScheduler(): MaintenanceScheduler {
    if (!this.scheduler) {
      throw new Error("Maintenance scheduler not initialized");
    }
    return this.scheduler;
  }

  private async broadcast(serverId: number): Promise<void> {
    try {
      const ws = await getService(Services.WEBSOCKET_SERVICE);
      await ws.triggerServerStatusUpdate(serverId);
    } catch {
      return;
    }
  }
}

export const maintenanceService = new MaintenanceService();
