import EventEmitter from "node:events";
import type {
  ActiveSession,
  ModPlayerJoinData,
  ModPlayerLeaveData,
  PlaytimeServiceConfig,
  ServerStatusSnapshot,
  SessionEndEvent,
  SessionMetadata,
  SessionStartEvent,
  MinecraftPlayer,
} from "./types";
import { ServerState } from "./types";
import { status } from "minecraft-server-util";
import {
  type MessageCacheService,
  MessageSource,
} from "../discord/message/cache";

// Minecraft's placeholder UUID, emitted by fakeplayers / CommandBlocks and
// sometimes returned in the server-list-ping sample for non-player entries.
// Never belongs in session tracking — rejected at every ingress point below.
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export interface PlaytimeServiceEvents {
  sessionStart: (event: SessionStartEvent) => void;
  sessionEnd: (event: SessionEndEvent) => void;
  sessionAggregated: (event: SessionEndEvent) => void;
  statusUpdate: (snapshot: ServerStatusSnapshot) => void;
  error: (error: Error) => void;
  serverShutdown: (serverId: number) => void;
  serverOffline: () => void;
  serverOnline: () => void;
  syncComplete: () => void;
}

interface TypedEventEmitter<T> {
  on<K extends keyof T>(event: K, listener: T[K]): this;
  emit<K extends keyof T>(
    event: K,
    ...args: T[K] extends (...args: infer A) => unknown ? A : never
  ): boolean;
}

/**
 * Core service for tracking Minecraft player playtime on a single server
 *
 * NEW ARCHITECTURE (HTTP-based):
 * - Primary method: Receives HTTP notifications from Minecraft mod on join/leave
 * - Fallback polling: Only used for backend restart recovery
 * - Message cache integration: Detects server shutdown from Discord relay
 *
 * Recovery Mechanisms:
 * 1. Server Crash: Message cache detects "server closed" → ends all sessions
 * 2. Backend Restart: Polls server on startup to sync active sessions
 *
 * Event Flow:
 * 1. Mod sends HTTP request → handlePlayerJoinFromMod/handlePlayerLeaveFromMod
 * 2. Creates/updates session in memory
 * 3. Emits sessionStart/sessionEnd events
 * 4. Repository layer persists to database
 *
 * Unlike old polling system:
 * - No continuous polling interval
 * - Instant player join/leave detection
 * - Lower server load
 * - More accurate session timestamps
 */
export class PlaytimeService extends (EventEmitter as new () => TypedEventEmitter<PlaytimeServiceEvents> &
  EventEmitter) {
  private config: Required<PlaytimeServiceConfig>;
  private activeSessions: Map<string, ActiveSession> = new Map();
  private isInitialized = false;
  private serverState: ServerState = ServerState.UNKNOWN;

  constructor(config: PlaytimeServiceConfig) {
    super();
    this.config = {
      pollIntervalMs: 30000,
      statusTimeoutMs: 5000,
      initialDelayMs: 5000,
      maxSyncRetries: 3,
      ...config,
    };
  }

  /**
   * Initializes the service and performs recovery sync
   *
   * On startup, checks if any players are online and syncs state.
   * This handles the case where backend restarted but server is still running.
   *
   * Recovery Process:
   * 1. Try to fetch server status (up to 3 retries)
   * 2. If server is online, compare with in-memory sessions
   * 3. End sessions for players no longer online
   * 4. Start sessions for players that are online but not tracked
   * 5. Emit syncComplete event
   *
   * @throws Does not throw - logs errors and continues
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn("PlaytimeService already initialized");
      return;
    }

    logger.info("Initializing PlaytimeService with HTTP notification mode...");

    await new Promise((resolve) =>
      setTimeout(resolve, this.config.initialDelayMs),
    );

    this.isInitialized = true;
    logger.info("PlaytimeService initialized");
  }

  /**
   * Detects the initial server state by inspecting recent Discord relay messages
   *
   * Looks for the most recent system message with a "server closed" description.
   * If found, marks the server as OFFLINE; otherwise assumes ONLINE. This is
   * called by PlaytimeManagerService after the MessageCacheService is ready.
   *
   * @param messageCacheService - Cache to inspect for recent system messages
   */
  public async detectServerState(
    messageCacheService: MessageCacheService,
  ): Promise<void> {
    try {
      logger.info(
        `Detecting initial server state for server ${this.config.serverId}...`,
      );

      const recentMessages = messageCacheService.getMessages(
        this.config.serverId,
        { limit: 100 },
      );

      const latestSystemMessage = recentMessages.find(
        (msg) =>
          msg.source === MessageSource.SYSTEM && msg.systemData?.description,
      );

      if (latestSystemMessage) {
        const description =
          latestSystemMessage.systemData!.description!.toLowerCase();

        if (description.includes("server closed")) {
          this.serverState = ServerState.OFFLINE;
          logger.info(
            `Server ${this.config.serverId} detected as OFFLINE (latest system message: "server closed")`,
          );
          this.emit("serverOffline");
          return;
        }
      }

      this.serverState = ServerState.ONLINE;
      logger.info(
        `Server ${this.config.serverId} detected as ONLINE (no recent "server closed" message)`,
      );
      this.emit("serverOnline");
    } catch (error) {
      logger.error(
        `Failed to detect initial server state for server ${this.config.serverId}:`,
        error,
      );
      this.serverState = ServerState.ONLINE; // Safer to assume online
    }
  }

  /**
   * Detect server state by examining recent Discord relay messages
   *
   * Looks for system embeds with "Server started" or "Server closed" in description
   * The most recent status message determines the current state
   *
   * @deprecated
   */
  private async detectInitialServerState(
    messageCacheService: MessageCacheService,
  ): Promise<void> {
    try {
      logger.info(
        `Detecting initial server state for server ${this.config.serverId}...`,
      );

      const recentMessage = messageCacheService.getMessages(
        this.config.serverId,
        { limit: 100 },
      );

      const latestSystemMessage = recentMessage.find(
        (msg) =>
          msg.source === MessageSource.SYSTEM && msg.systemData?.description,
      );

      if (latestSystemMessage) {
        const description =
          latestSystemMessage.systemData!.description!.toLowerCase();

        if (description.includes("server closed")) {
          this.serverState = ServerState.OFFLINE;
          logger.info(
            `Server ${this.config.serverId} detected as OFFLINE (latest system message: "server closed")`,
          );
          this.emit("serverOffline");
          return;
        }
      }

      this.serverState = ServerState.ONLINE;
      logger.info(
        `Server ${this.config.serverId} detected as ONLINE (no recent "server closed" events)`,
      );
      this.emit("serverOnline");
    } catch (error) {
      logger.error(
        `Failed to detect initial server state for server ${this.config.serverId}`,
        error,
      );

      this.serverState = ServerState.OFFLINE;
    }
  }

  /**
   * Performs recovery sync on backend restart
   *
   * Polls the Minecraft server to check which players are currently online
   * and reconciles with in-memory session state.
   *
   * Retry Logic:
   * - Attempts up to maxSyncRetries times (default: 3)
   * - 2 second delay between retries
   * - If all retries fail, assumes server is offline
   */
  async performRecoverySync(): Promise<void> {
    logger.info("Starting recovery sync...");

    let retries = 0;
    let synced = false;

    while (retries < this.config.maxSyncRetries && !synced) {
      try {
        const serverStatus = await this.fetchServerStatus();
        synced = true;

        const onlinePlayers = serverStatus.onlinePlayers;
        const onlineUuids = new Set(onlinePlayers.map((p) => p.uuid));

        logger.info(
          `Recovery sync found ${onlinePlayers.length} online player(s)`,
        );

        const playersToRemove: string[] = [];
        for (const [uuid, session] of this.activeSessions) {
          if (!onlineUuids.has(uuid)) {
            logger.info(
              `Recovery sync: Ending stale session for ${session.username} (${uuid})`,
            );
            playersToRemove.push(uuid);
            this.handlePlayerLeave(session);
          }
        }
        playersToRemove.forEach((uuid) => this.activeSessions.delete(uuid));

        for (const player of onlinePlayers) {
          if (!this.activeSessions.has(player.uuid)) {
            logger.info(
              `Recovery sync: Starting session for ${player.username} (${player.uuid})`,
            );
            this.handlePlayerJoin(player);
          } else {
            logger.debug(
              `Recovery sync: Player ${player.username} (${player.uuid} already has active session)`,
            );
          }
        }

        this.emit("statusUpdate", serverStatus);
        this.emit("syncComplete");

        logger.info("Recovery sync completed successfully");
      } catch (error) {
        retries++;
        const err = error instanceof Error ? error : new Error(String(error));

        if (retries < this.config.maxSyncRetries) {
          logger.warn(
            `Recovery sync failed (attempt ${retries}/${this.config.maxSyncRetries}): ${err.message}. Retrying in 2s...`,
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          logger.warn(
            `Recovery sync failed after ${this.config.maxSyncRetries} attempts. Assuming server is offline`,
          );
          this.emit("error", err);
        }
      }
    }

    if (!synced) {
      logger.info(
        "Recovery sync skipped - server appears to be offline. Will track sessions when player join.",
      );
    }
  }

  /**
   * Handles player join notification from Minecraft mod
   *
   * Called when mod sends HTTP request with player join event.
   * Creates new session and emits sessionStart event.
   *
   * @param data - Player join data from mod
   */
  public async handlePlayerJoinFromMod(data: ModPlayerJoinData): Promise<void> {
    if (data.uuid === NIL_UUID) {
      logger.debug(
        `Ignoring join for nil UUID (fakeplayer or placeholder): ${data.username}`,
      );
      return;
    }

    if (this.activeSessions.has(data.uuid)) {
      logger.warn(
        `Player ${data.username} (${data.uuid}) already has an active session. Ignoring duplicate join.`,
      );
      return;
    }

    const session: ActiveSession = {
      uuid: data.uuid,
      username: data.username,
      serverId: this.config.serverId,
      sessionStart: data.timestamp || new Date(),
      metadata: {
        displayName: data.displayName,
        gamemode: data.gamemode,
        dimension: data.dimension,
        position: data.position,
        health: data.health,
        experienceLevel: data.experienceLevel,
        ipAddress: data.ipAddress,
      },
    };

    this.activeSessions.set(data.uuid, session);

    const event: SessionStartEvent = {
      uuid: session.uuid,
      username: session.username,
      serverId: session.serverId,
      sessionStart: session.sessionStart,
      metadata: session.metadata,
    };

    this.emit("sessionStart", event);

    logger.info(
      `Session started for ${data.username} (${data.uuid}) via mod notification`,
    );
  }
  /**
   * Handles player leave notification from Minecraft mod
   *
   * Called when mod sends HTTP request with player leave event.
   * Ends session and emits sessionEnd event.
   *
   * @param data - Player leave data from mod
   */
  public async handlePlayerLeaveFromMod(
    data: ModPlayerLeaveData,
  ): Promise<void> {
    if (data.uuid === NIL_UUID) {
      logger.debug(
        `Ignoring leave for nil UUID (fakeplayer or placeholder): ${data.username}`,
      );
      return;
    }

    const session = this.activeSessions.get(data.uuid);
    const sessionEnd = data.timestamp || new Date();

    // Build metadata from the leave payload (position at disconnect)
    const metadata: SessionMetadata | undefined =
      data.position || data.dimension
        ? { position: data.position, dimension: data.dimension }
        : undefined;

    if (!session) {
      logger.warn(
        `Received leave notification for ${data.username} (${data.uuid}) but no active in-memory session found. ` +
          `Emitting orphaned sessionEnd to close any DB sessions.`,
      );

      // Emit a special sessionEnd with sessionId 0 to signal the repository
      // to close any orphaned DB sessions for this player on this server
      const event: SessionEndEvent = {
        sessionId: 0,
        uuid: data.uuid,
        username: data.username,
        serverId: this.config.serverId,
        sessionStart: sessionEnd,
        sessionEnd,
        secondsPlayed: 0,
        metadata,
      };

      this.emit("sessionEnd", event);
      return;
    }

    const secondsPlayed = Math.floor(
      (sessionEnd.getTime() - session.sessionStart.getTime()) / 1000,
    );

    if (!session.sessionId) {
      logger.warn(
        `Cannot emit sessionEnd for ${session.username} (${session.uuid}) - no sessionId set. ` +
          `Repository may not have processed sessionStart yet. Emitting orphaned sessionEnd.`,
      );

      const event: SessionEndEvent = {
        sessionId: 0,
        uuid: session.uuid,
        username: session.username,
        serverId: session.serverId,
        sessionStart: session.sessionStart,
        sessionEnd,
        secondsPlayed,
        metadata,
      };

      this.emit("sessionEnd", event);
      this.activeSessions.delete(data.uuid);
      return;
    }

    const event: SessionEndEvent = {
      sessionId: session.sessionId,
      uuid: session.uuid,
      username: session.username,
      serverId: session.serverId,
      sessionStart: session.sessionStart,
      sessionEnd,
      secondsPlayed,
      metadata,
    };

    this.emit("sessionEnd", event);
    this.activeSessions.delete(data.uuid);

    logger.info(
      `Session ended for ${session.username} (${session.uuid}) via mod notification - ${secondsPlayed}s played`,
    );
  }

  /**
   * Handles server shutdown detected by message cache
   *
   * Called when Discord relay bot detects "server closed" message.
   * Ends all active sessions gracefully FOR THIS SERVER ONLY.
   *
   * This is the fallback mechanism for cases where:
   * - Server crashes without sending leave notifications
   * - Mod fails to send leave events
   * - Network issues prevent HTTP requests
   */
  public handleServerShutdown(): void {
    if (this.activeSessions.size === 0) {
      logger.info("Server shutdown detected but no active sessions to end");
    } else {
      logger.warn(
        `Server ${this.config.serverId} shutdown detected - ending ${this.activeSessions.size} active session(s)`,
      );
      this.endAllSessions();
    }

    this.serverState = ServerState.OFFLINE;
    this.emit("serverShutdown", this.config.serverId);
    this.emit("serverOffline");
  }

  /**
   * Handles server startup detected by message cache
   *
   * Called when Discord relay bot detects "server started" message.
   * Currently just logs and emits event - no action needed since
   * mod will send join notifications as players connect.
   */
  public handleServerStartup(): void {
    logger.info(
      `Server ${this.config.serverId} startup detected by message cache`,
    );

    this.serverState = ServerState.ONLINE;
    this.emit("serverOnline");
  }

  /**
   * Reconciles in-memory sessions against the actual player list from the mod heartbeat.
   *
   * Ends sessions for any players tracked as online but not present in the heartbeat.
   * Starts sessions for any players present in the heartbeat but not tracked.
   *
   * @param onlinePlayers - Full list of players currently on the server (from mod)
   */
  public reconcileWithHeartbeat(onlinePlayers: MinecraftPlayer[]): void {
    const onlineUuids = new Set(onlinePlayers.map((p) => p.uuid));

    // End stale sessions for players not actually online
    const staleUuids: string[] = [];
    for (const [uuid, session] of this.activeSessions) {
      if (!onlineUuids.has(uuid)) {
        logger.warn(
          `Heartbeat reconciliation: ending stale session for ${session.username} (${uuid})`,
        );
        staleUuids.push(uuid);
        this.handlePlayerLeave(session);
      }
    }
    for (const uuid of staleUuids) {
      this.activeSessions.delete(uuid);
    }

    // Start sessions for players online but not tracked
    for (const player of onlinePlayers) {
      if (!this.activeSessions.has(player.uuid)) {
        logger.warn(
          `Heartbeat reconciliation: starting missing session for ${player.username} (${player.uuid})`,
        );
        this.handlePlayerJoin(player);
      }
    }

    if (
      staleUuids.length > 0 ||
      onlinePlayers.some((p) => !this.activeSessions.has(p.uuid))
    ) {
      logger.info(
        `Heartbeat reconciliation complete: ended ${staleUuids.length} stale, tracking ${this.activeSessions.size} active`,
      );
    } else {
      logger.debug(
        `Heartbeat reconciliation: all ${this.activeSessions.size} sessions consistent`,
      );
    }

    // Mark server as online if we receive a heartbeat
    if (this.serverState !== ServerState.ONLINE) {
      this.serverState = ServerState.ONLINE;
      this.emit("serverOnline");
    }
  }

  /**
   * Fetches current server status via minecraft-server-util library
   *
   * Used only for recovery sync on backend restart.
   * Not used during normal operation.
   *
   * @returns ServerStatusSnapshot with current server state
   * @throws Error if server is unreachable or times out
   *
   * @private
   */
  private async fetchServerStatus(): Promise<ServerStatusSnapshot> {
    const response = await status(
      this.config.serverIp,
      this.config.serverPort,
      {
        timeout: this.config.statusTimeoutMs,
      },
    );

    // The server-list-ping sample can include entries for fakeplayers /
    // CommandBlocks / chunkloaders that were placed on the player list. Drop
    // nil-UUID entries here so recovery sync never feeds them into the
    // sessionStart/sessionEnd pipeline.
    const onlinePlayers: MinecraftPlayer[] = (response.players.sample || [])
      .filter((player) => player.id !== NIL_UUID)
      .map((player) => ({
        uuid: player.id,
        username: player.name,
      }));

    return {
      onlinePlayers,
      playerCount: response.players.online,
      maxPlayers: response.players.max,
      timestamp: new Date(),
    };
  }

  /**
   * Handles a player joining the server (internal)
   *
   * Used by recovery sync and manual operations.
   * For mod notifications, use handlePlayerJoinFromMod instead.
   *
   * @param player - Player who joined (UUID + username)
   * @private
   */
  private handlePlayerJoin(player: MinecraftPlayer): void {
    if (this.serverState !== ServerState.ONLINE) {
      logger.info(
        `Server ${this.config.serverId} marked as ONLINE (player join received)`,
      );
      this.serverState = ServerState.ONLINE;
      this.emit("serverOnline");
    }

    const session: ActiveSession = {
      uuid: player.uuid,
      username: player.username,
      serverId: this.config.serverId,
      sessionStart: new Date(),
    };

    this.activeSessions.set(player.uuid, session);

    const event: SessionStartEvent = {
      uuid: session.uuid,
      username: session.username,
      serverId: session.serverId,
      sessionStart: session.sessionStart,
    };

    this.emit("sessionStart", event);

    logger.debug(`Session started for ${player.username} (${player.uuid})`);
  }

  /**
   * Handles a player leaving the server (internal)
   *
   * Used by recovery sync and shutdown operations.
   * For mod notifications, use handlePlayerLeaveFromMod instead.
   *
   * @param session - Active session for player who left
   * @private
   */
  private handlePlayerLeave(session: ActiveSession): void {
    const now = new Date();
    const secondsPlayed = Math.floor(
      (now.getTime() - session.sessionStart.getTime()) / 1000,
    );

    const event: SessionEndEvent = {
      sessionId: session.sessionId ?? 0,
      uuid: session.uuid,
      username: session.username,
      serverId: session.serverId,
      sessionStart: session.sessionStart,
      sessionEnd: now,
      secondsPlayed,
    };

    this.emit("sessionEnd", event);

    logger.debug(
      `Session ended for ${session.username} (${session.uuid}) - ${secondsPlayed}s played`,
    );
  }

  /**
   * Gracefully ends all active sessions
   *
   * Called during:
   * - Service shutdown
   * - Server crash detected by message cache
   * - Recovery sync cleanup
   *
   * @private
   */
  private endAllSessions(): void {
    if (this.activeSessions.size === 0) {
      return;
    }

    logger.info(`Ending ${this.activeSessions.size} active session(s)`);

    for (const session of this.activeSessions.values()) {
      this.handlePlayerLeave(session);
    }

    this.activeSessions.clear();
  }

  /**
   * Associates a database session ID with an active in-memory session
   *
   * Called by repository after persisting session to database.
   * Required for emitting sessionEnd events with proper DB reference.
   *
   * @param uuid - Minecraft player UUID
   * @param sessionId - Database-generated session ID
   */
  public setSessionId(uuid: string, sessionId: number): void {
    const session = this.activeSessions.get(uuid);
    if (session) {
      session.sessionId = sessionId;
      logger.debug(`Set sessionId ${sessionId} for player ${uuid}`);
    } else {
      logger.warn(`Cannot set sessionId for ${uuid} - session not found`);
    }
  }

  /**
   * Gets all currently active player sessions
   *
   * @returns Array of active sessions
   */
  public getActiveSessions(): ActiveSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Checks if a specific player is currently online
   *
   * @param uuid - Minecraft player UUID to check
   * @returns True if player has an active session, false otherwise
   */
  public isPlayerOnline(uuid: string): boolean {
    return this.activeSessions.has(uuid);
  }

  /**
   * Retrieves the active session for a specific player
   *
   * @param uuid - Minecraft player UUID
   * @returns ActiveSession object if player is online, undefined otherwise
   */
  public getSession(uuid: string): ActiveSession | undefined {
    return this.activeSessions.get(uuid);
  }

  /**
   * Gets the current count of online players
   *
   * @returns Number of players with active sessions
   */
  public getOnlineCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Calculates how long a player has been online in their current session
   *
   * @param identifier - Minecraft player UUID string or an ActiveSession object
   * @returns Duration in seconds since session start, or null if player is not online
   */
  public getSessionDuration(identifier: string | ActiveSession): number | null {
    let session: ActiveSession | undefined;
    if (typeof identifier === "string") {
      session = this.activeSessions.get(identifier);
    } else {
      session = this.activeSessions.get(identifier.uuid);
    }
    if (!session) {
      return null;
    }

    return Math.floor((Date.now() - session.sessionStart.getTime()) / 1000);
  }

  /**
   * Stops the playtime service and ends all sessions
   *
   * Called during graceful shutdown.
   */
  public stop(): void {
    logger.info("Stopping PlaytimeService...");
    this.endAllSessions();
    // Emit serverShutdown so repository closes any orphaned DB sessions
    // not tracked in memory (e.g. from before a backend restart)
    this.emit("serverShutdown", this.config.serverId);
    this.isInitialized = false;
    logger.info("PlaytimeService stopped");
  }

  /**
   * Returns the current state of this server (ONLINE, OFFLINE, or UNKNOWN)
   *
   * @returns The current ServerState value
   */
  public getServerState(): ServerState {
    return this.serverState;
  }

  /**
   * Returns whether the server is currently considered online
   *
   * @returns True if server state is ONLINE
   */
  public isOnline(): boolean {
    return this.serverState === ServerState.ONLINE;
  }

  /**
   * Gets current service status
   *
   * @returns Object containing runtime status
   */
  public getStatus(): {
    isInitialized: boolean;
    activeSessions: number;
    serverState: ServerState;
    config: PlaytimeServiceConfig;
  } {
    return {
      isInitialized: this.isInitialized,
      activeSessions: this.activeSessions.size,
      serverState: this.serverState,
      config: this.config,
    };
  }
}
