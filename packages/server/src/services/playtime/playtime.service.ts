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
// Never belongs in session tracking: rejected at every ingress point below.
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
 * Tracks Minecraft player playtime for a single server. Primary trigger is
 * HTTP join/leave notifications from the Minecraft mod, kept in memory and
 * emitted as sessionStart/sessionEnd events for the repository to persist.
 * Recovery uses a one-shot status poll on startup plus message-cache hooks
 * to detect server shutdown from the Discord relay. Nil-UUID entries
 * (fakeplayers, CommandBlocks) are rejected at every ingress.
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

  /** Waits the configured initial delay, then marks the service ready. Idempotent. */
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
   * Sets initial server state by scanning recent relay messages for a "server
   * closed" system embed; absence is treated as ONLINE. Errors fall back to
   * ONLINE so a cache lookup failure doesn't mask a live server.
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

  /** @deprecated */
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
   * Polls the Minecraft server (up to `maxSyncRetries` with a 2s delay) and
   * reconciles in-memory sessions against the live player list. Used once on
   * backend restart; if every attempt fails the server is treated as offline.
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

  /** Creates an in-memory session from a mod join payload and emits sessionStart. Duplicate joins for the same UUID are dropped. */
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
   * Ends the in-memory session matching the mod leave payload and emits
   * sessionEnd. If no session is tracked (or its DB id was never set) emits
   * an orphaned event with sessionId 0 so the repository can clean up.
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

  /** Fallback for crash / network failure: ends every active session on this server and emits serverShutdown + serverOffline. */
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

  /** Marks the server ONLINE and emits serverOnline. No session work: mod join events do the rest. */
  public handleServerStartup(): void {
    logger.info(
      `Server ${this.config.serverId} startup detected by message cache`,
    );

    this.serverState = ServerState.ONLINE;
    this.emit("serverOnline");
  }

  /** Reconciles tracked sessions against the heartbeat player list: ends stale ones, opens missing ones, and forces ONLINE state. */
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

  private handlePlayerJoin(player: MinecraftPlayer): void {
    if (player.uuid === NIL_UUID) {
      logger.debug(
        `Ignoring internal join for nil UUID (fakeplayer or placeholder): ${player.username}`,
      );
      return;
    }

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

  private handlePlayerLeave(session: ActiveSession): void {
    if (session.uuid === NIL_UUID) {
      logger.debug(
        `Ignoring internal leave for nil UUID (fakeplayer or placeholder): ${session.username}`,
      );
      return;
    }

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

  /** Attaches the DB-generated session id to the in-memory session so later sessionEnd events can reference it. */
  public setSessionId(uuid: string, sessionId: number): void {
    const session = this.activeSessions.get(uuid);
    if (session) {
      session.sessionId = sessionId;
      logger.debug(`Set sessionId ${sessionId} for player ${uuid}`);
    } else {
      logger.warn(`Cannot set sessionId for ${uuid} - session not found`);
    }
  }

  /** Returns a snapshot of every currently tracked in-memory session. */
  public getActiveSessions(): ActiveSession[] {
    return Array.from(this.activeSessions.values());
  }

  /** True if the player has a tracked in-memory session on this server. */
  public isPlayerOnline(uuid: string): boolean {
    return this.activeSessions.has(uuid);
  }

  /** Returns the tracked session for the given UUID, or undefined if none. */
  public getSession(uuid: string): ActiveSession | undefined {
    return this.activeSessions.get(uuid);
  }

  /** Number of tracked in-memory sessions on this server. */
  public getOnlineCount(): number {
    return this.activeSessions.size;
  }

  /** Seconds elapsed in the player's current session, or null if no session is tracked. Accepts a UUID or an ActiveSession. */
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

  /** Ends every tracked session and emits serverShutdown so the repository closes orphaned DB rows. */
  public stop(): void {
    logger.info("Stopping PlaytimeService...");
    this.endAllSessions();
    // Emit serverShutdown so repository closes any orphaned DB sessions
    // not tracked in memory (e.g. from before a backend restart)
    this.emit("serverShutdown", this.config.serverId);
    this.isInitialized = false;
    logger.info("PlaytimeService stopped");
  }

  /** Current ServerState (ONLINE, OFFLINE, or UNKNOWN) for this server. */
  public getServerState(): ServerState {
    return this.serverState;
  }

  /** True if the server state is ONLINE. */
  public isOnline(): boolean {
    return this.serverState === ServerState.ONLINE;
  }

  /** Runtime snapshot: init flag, active session count, server state, and resolved config. */
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
