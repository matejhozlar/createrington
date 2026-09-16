import { playtimeRepo } from "@/db";
import { MINECRAFT_SERVERS } from "./config";
import { getPlaytimeForwarder } from "./forwarder.service";
import { PlaytimeService } from "./playtime.service";
import type { MessageCacheService } from "../discord/message/cache";
import { ServerState } from "./types";

const SHUTDOWN_FLUSH_TIMEOUT_MS = 5000;

interface BringUpOptions {
  forward: boolean;
}

/**
 * Coordinates one PlaytimeService per Minecraft server: spins up each entry
 * of MINECRAFT_SERVERS at boot, restores the sessions the previous process
 * left open, wires them to the playtime repository and, when sync is
 * configured, to the playtime forwarder, and exposes per-server status.
 * Servers outside the static config, such as the synced test server, get
 * the same bring-up on first use through `ensureService()`, minus the
 * forwarder, because they only ever receive events. One bring-up per server
 * id is guaranteed, whichever path asks first. `initialize()` throws if zero
 * services succeed; per-server failures are logged and skipped. Shutdown
 * leaves sessions open in the database on purpose (a backend restart is not
 * a player event), waits for in-flight bring-ups and writes, and refuses new
 * bring-ups afterwards. Call `setupMessageCacheIntegration()` after
 * `initialize()` to enable server start/shutdown detection from the Discord
 * relay.
 */
export class PlaytimeManagerService {
  private playtimeServices: Map<number, PlaytimeService> = new Map();
  private pendingServices: Map<number, Promise<PlaytimeService>> = new Map();
  private messageCacheService?: MessageCacheService;
  private stopped = false;

  /** Brings up a PlaytimeService for each entry in MINECRAFT_SERVERS in parallel. Throws if none succeed. */
  async initialize(): Promise<void> {
    logger.info("Initializing the PlaytimeManagerService...");

    const serverConfigs = Object.values(MINECRAFT_SERVERS);

    if (serverConfigs.length === 0) {
      logger.warn(
        "No Minecraft servers configured. Playtime tracking disabled",
      );
      return;
    }

    logger.info(`Initializing ${serverConfigs.length} playtime service(s)`);

    const initPromises = serverConfigs.map(async (serverConfig) => {
      const serverId = serverConfig.id;

      try {
        logger.info(
          `Initializing PlaytimeService for server ${serverId} (${serverConfig.name})...`,
        );

        await this.bringUp(serverId, { forward: true });
      } catch (error) {
        logger.error(
          `Failed to initialize PlaytimeService for server ${serverId}:`,
          error,
        );
      }
    });

    await Promise.all(initPromises);

    if (this.playtimeServices.size === 0) {
      throw new Error("No PlaytimeServices initialized");
    }

    logger.info(
      `PlaytimeManagerService initialized with ${this.playtimeServices.size}/${serverConfigs.length} server(s)`,
    );
  }

  /**
   * Returns the PlaytimeService for `serverId`, creating, hydrating and
   * starting it on first use. Services created this way only receive events
   * (the synced test server), so they are not wired to the forwarder.
   */
  ensureService(serverId: number): Promise<PlaytimeService> {
    return this.bringUp(serverId, { forward: false });
  }

  private bringUp(
    serverId: number,
    options: BringUpOptions,
  ): Promise<PlaytimeService> {
    if (this.stopped) {
      return Promise.reject(new Error("PlaytimeManagerService is shut down"));
    }

    const existing = this.playtimeServices.get(serverId);
    if (existing) return Promise.resolve(existing);

    let pending = this.pendingServices.get(serverId);
    if (!pending) {
      pending = this.createService(serverId, options)
        .then((service) => {
          if (this.stopped) {
            service.stop();
            throw new Error(
              `PlaytimeManagerService shut down while bringing up server ${serverId}`,
            );
          }
          this.playtimeServices.set(serverId, service);
          return service;
        })
        .finally(() => {
          this.pendingServices.delete(serverId);
        });
      this.pendingServices.set(serverId, pending);
    }

    return pending;
  }

  private async createService(
    serverId: number,
    options: BringUpOptions,
  ): Promise<PlaytimeService> {
    const openSessions = await playtimeRepo.getOpenSessions(serverId);

    const service = new PlaytimeService({ serverId });
    service.hydrate(openSessions);

    playtimeRepo.connectToService(service, serverId);
    if (options.forward) {
      getPlaytimeForwarder()?.connectToService(service, serverId);
    }

    service.initialize();

    return service;
  }

  /** Stops every PlaytimeService, waits for in-flight bring-ups and writes, and refuses new bring-ups afterwards. */
  async shutdown(): Promise<void> {
    this.stopped = true;

    await Promise.allSettled([...this.pendingServices.values()]);
    this.pendingServices.clear();

    if (this.playtimeServices.size === 0) {
      return;
    }

    logger.info(
      `Shutting down ${this.playtimeServices.size} PlaytimeService(s)...`,
    );

    for (const [serverId, service] of this.playtimeServices) {
      logger.info(`Stopping PlaytimeService for server ${serverId}...`);
      service.stop();
    }

    this.playtimeServices.clear();
    await playtimeRepo.flush(SHUTDOWN_FLUSH_TIMEOUT_MS);
    logger.info("All PlaytimeServices shut down");
  }

  /** Returns the PlaytimeService for `serverId`, or undefined if not initialized. */
  getService(serverId: number): PlaytimeService | undefined {
    return this.playtimeServices.get(serverId);
  }

  /** Returns a shallow copy of the server-id to PlaytimeService map. */
  getAllServices(): Map<number, PlaytimeService> {
    return new Map(this.playtimeServices);
  }

  /** True if at least one PlaytimeService is initialized. */
  isInitialized(): boolean {
    return this.playtimeServices.size > 0;
  }

  /** True if the named server's PlaytimeService reports ONLINE. False if offline or unknown. */
  isServerOnline(serverId: number): boolean {
    const service = this.playtimeServices.get(serverId);
    return service?.isOnline() ?? false;
  }

  /** Current ServerState for `serverId`, or undefined if no service exists for it. */
  getServerState(serverId: number): ServerState | undefined {
    const service = this.playtimeServices.get(serverId);
    return service?.getServerState();
  }

  /** Per-server status snapshot keyed by server id (calls PlaytimeService.getStatus on each). */
  getStatus(): Record<number, ReturnType<PlaytimeService["getStatus"]>> {
    const status: ReturnType<PlaytimeManagerService["getStatus"]> = {};
    for (const [serverId, service] of this.playtimeServices) {
      status[serverId] = service.getStatus();
    }
    return status;
  }

  /**
   * Seeds each server's initial state from the message cache and subscribes
   * to ongoing serverClosed / serverStarted events. Fire-and-forget per
   * server: failures are logged but do not block the others.
   */
  setupMessageCacheIntegration(messageCacheService: MessageCacheService): void {
    this.messageCacheService = messageCacheService;

    logger.info(
      "Setting up message cache integration for playtime services...",
    );

    for (const [serverId, service] of this.playtimeServices) {
      service
        .detectServerState(messageCacheService)
        .then(() => {
          logger.info(
            `Server ${serverId} state detected: ${service.getServerState()}`,
          );
        })
        .catch((error) => {
          logger.error(`Failed to detect state for server ${serverId}:`, error);
        });
    }

    messageCacheService.on("serverClosed", (serverId: number) => {
      const service = this.playtimeServices.get(serverId);
      if (service) {
        logger.info(
          `Server ${serverId} shutdown detected - ending all sessions`,
        );
        service.handleServerShutdown();
      }
    });

    messageCacheService.on("serverStarted", (serverId: number) => {
      const service = this.playtimeServices.get(serverId);
      if (service) {
        logger.info(`Server ${serverId} startup detected`);
        service.handleServerStartup();
      }
    });

    logger.info("Message cache integration configured");
  }
}
