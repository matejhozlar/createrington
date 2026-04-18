import { playtimeRepo } from "@/db";
import { MINECRAFT_SERVERS } from "./config";
import { PlaytimeService } from "./playtime.service";
import type { MessageCacheService } from "../discord/message/cache";
import { ServerState } from "./types";

/**
 * Playtime Manager Service
 *
 * Coordinates playtime tracking across all configured Minecraft servers:
 * - Instantiates and initializes a PlaytimeService per server on startup
 * - Connects each PlaytimeService to the playtime repository
 * - Integrates with MessageCacheService to detect server start/shutdown events
 * - Performs orphaned session cleanup on startup (handles backend restarts)
 * - Exposes aggregate and per-server status queries for monitoring
 *
 * NOTE: Throws during initialization if no PlaytimeServices can be started.
 * setupMessageCacheIntegration must be called after initialize() to enable
 * crash/restart recovery and live server state detection.
 */
export class PlaytimeManagerService {
  private playtimeServices: Map<number, PlaytimeService> = new Map();
  private messageCacheService?: MessageCacheService;

  /**
   * Initializes playtime services for all configured Minecraft servers
   *
   * For each server in MINECRAFT_SERVERS config:
   * 1. Validates that IP and port are present
   * 2. Creates a PlaytimeService with the server's connection details
   * 3. Connects the service to the playtime repository
   * 4. Initializes the service and registers it in the internal map
   *
   * Individual server failures are logged but do not abort the full init.
   * Throws if zero services succeed.
   *
   * @returns Promise that resolves when all services have been initialized
   */
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
        if (!serverConfig.ip || !serverConfig.port) {
          throw new Error(`Server ${serverId} missing IP or port`);
        }

        logger.info(
          `Initializing PlaytimeService for server ${serverId} (${serverConfig.name})...`,
        );

        const service = new PlaytimeService({
          serverIp: serverConfig.ip,
          serverPort: serverConfig.port,
          serverId,
          pollIntervalMs: 10000,
          statusTimeoutMs: 5000,
          initialDelayMs: 0,
          maxSyncRetries: 3,
        });

        playtimeRepo.connectToService(service, serverId);

        await service.initialize();

        this.playtimeServices.set(serverId, service);

        logger.info(`PlaytimeService initialized for server ${serverId}`);
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
   * Shuts down all active playtime services
   *
   * Calls stop() on each PlaytimeService, which ends all in-memory sessions
   * and emits a serverShutdown event so the repository can close DB sessions.
   *
   * @returns Promise that resolves when all services have stopped
   */
  async shutdown(): Promise<void> {
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
    logger.info("All PlaytimeServices shut down");
  }

  /**
   * Returns the PlaytimeService for a specific server
   *
   * @param serverId - Numeric server ID
   * @returns The PlaytimeService instance, or undefined if not initialized
   */
  getService(serverId: number): PlaytimeService | undefined {
    return this.playtimeServices.get(serverId);
  }

  /**
   * Returns a shallow copy of the internal service map
   *
   * @returns Map of server ID to PlaytimeService for all initialized servers
   */
  getAllServices(): Map<number, PlaytimeService> {
    return new Map(this.playtimeServices);
  }

  /**
   * Returns whether at least one PlaytimeService has been successfully initialized
   *
   * @returns True if one or more server services are active
   */
  isInitialized(): boolean {
    return this.playtimeServices.size > 0;
  }

  /**
   * Checks whether a specific server is currently considered online
   *
   * @param serverId - Numeric server ID
   * @returns True if the server's state is ONLINE, false if offline or not found
   */
  isServerOnline(serverId: number): boolean {
    const service = this.playtimeServices.get(serverId);
    return service?.isOnline() ?? false;
  }

  /**
   * Returns the current state of a specific server
   *
   * @param serverId - Numeric server ID
   * @returns The server's ServerState, or undefined if no service exists for it
   */
  getServerState(serverId: number): ServerState | undefined {
    const service = this.playtimeServices.get(serverId);
    return service?.getServerState();
  }

  /**
   * Returns a status snapshot for all initialized services, keyed by server ID
   *
   * @returns Object mapping server ID to the result of PlaytimeService.getStatus()
   */
  getStatus(): Record<number, ReturnType<PlaytimeService["getStatus"]>> {
    const status: ReturnType<PlaytimeManagerService["getStatus"]> = {};
    for (const [serverId, service] of this.playtimeServices) {
      status[serverId] = service.getStatus();
    }
    return status;
  }

  /**
   * Wires up the MessageCacheService for server lifecycle detection
   *
   * On call:
   * 1. Runs detectServerState() for each PlaytimeService to determine initial
   *    online/offline state from recent Discord relay messages
   * 2. If a server is ONLINE, performs recovery sync and closes any DB sessions
   *    for players no longer present on the live server
   * 3. If a server is OFFLINE, ends all active DB sessions for that server
   * 4. Subscribes to "serverClosed" and "serverStarted" events for ongoing
   *    detection during normal runtime
   *
   * @param messageCacheService - The MessageCacheService instance to integrate with
   */
  setupMessageCacheIntegration(messageCacheService: MessageCacheService): void {
    this.messageCacheService = messageCacheService;

    logger.info(
      "Setting up message cache integration for playtime services...",
    );

    for (const [serverId, service] of this.playtimeServices) {
      service
        .detectServerState(messageCacheService)
        .then(async () => {
          logger.info(
            `Server ${serverId} state detected: ${service.getServerState()}`,
          );

          if (service.getServerState() === ServerState.ONLINE) {
            // Server is online — perform recovery sync, then close DB sessions
            // for players that aren't actually online
            try {
              await service.performRecoverySync();

              const onlineUuids = new Set(
                service.getActiveSessions().map((s) => s.uuid),
              );
              const orphanedSessions =
                await playtimeRepo.getActiveSessions(serverId);

              let closedCount = 0;
              for (const session of orphanedSessions) {
                if (!onlineUuids.has(session.playerMinecraftUuid)) {
                  await playtimeRepo.endSession({
                    sessionId: session.id,
                    uuid: session.playerMinecraftUuid,
                    username: "",
                    serverId,
                    sessionStart: session.sessionStart,
                    sessionEnd: new Date(),
                    secondsPlayed: 0,
                  });
                  closedCount++;
                }
              }

              if (closedCount > 0) {
                logger.warn(
                  `Startup: Closed ${closedCount} orphaned DB session(s) for server ${serverId}`,
                );
              }
            } catch (error) {
              logger.error(
                `Recovery sync failed for server ${serverId}:`,
                error,
              );
            }
          } else {
            // Server is offline — close all active DB sessions
            const count = await playtimeRepo.endAllActiveSessions(serverId);
            if (count > 0) {
              logger.warn(
                `Startup: Server ${serverId} offline — closed ${count} orphaned DB session(s)`,
              );
            }
          }
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
