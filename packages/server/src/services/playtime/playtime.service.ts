import EventEmitter from "node:events";
import type { OpenSessionEntry } from "@/db/queries/player/session";
import type {
  ActiveSession,
  HeartbeatPlayer,
  ModPlayerJoinData,
  ModPlayerLeaveData,
  PlaytimeServiceConfig,
  SessionEndEvent,
  SessionMetadata,
  SessionProgressEvent,
  SessionStartEvent,
} from "./types";
import { ServerState } from "./types";
import { computeCredit } from "./credit";
import {
  type MessageCacheService,
  MessageSource,
} from "../discord/message/cache";

// Minecraft's placeholder UUID, emitted by fakeplayers / CommandBlocks.
// Never belongs in session tracking: rejected at every ingress point below.
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1000;
const DEFAULT_WATCHDOG_INTERVAL_MS = 60 * 1000;

export interface PlaytimeServiceEvents {
  sessionStart: (event: SessionStartEvent) => void;
  sessionProgress: (event: SessionProgressEvent) => void;
  sessionEnd: (event: SessionEndEvent) => void;
  sessionAggregated: (event: SessionEndEvent) => void;
  error: (error: Error) => void;
  serverOffline: () => void;
  serverOnline: () => void;
}

interface TypedEventEmitter<T> {
  on<K extends keyof T>(event: K, listener: T[K]): this;
  emit<K extends keyof T>(
    event: K,
    ...args: T[K] extends (...args: infer A) => unknown ? A : never
  ): boolean;
}

/**
 * Tracks Minecraft player playtime for a single server. The mod drives it
 * with HTTP join/leave notifications plus a periodic heartbeat carrying the
 * online roster and each player's vanilla play_time stat. Playtime is
 * credited per observation from the tick delta (so time the server froze
 * the stat for, e.g. while AFK, earns nothing), falling back to wall-clock
 * when the mod sends no ticks. Sessions live in memory but are restored
 * from their DB rows on boot via hydrate(), so a backend restart is not a
 * session boundary. A watchdog closes sessions that stop being confirmed,
 * ending them at the last instant the player was seen. Nil-UUID entries
 * (fakeplayers, CommandBlocks) are rejected at every ingress.
 */
export class PlaytimeService extends (EventEmitter as new () => TypedEventEmitter<PlaytimeServiceEvents> &
  EventEmitter) {
  private config: Required<PlaytimeServiceConfig>;
  private activeSessions: Map<string, ActiveSession> = new Map();
  private isInitialized = false;
  private serverState: ServerState = ServerState.UNKNOWN;
  private startedAt = new Date();
  private lastHeartbeatAt?: Date;
  private watchdog?: NodeJS.Timeout;

  constructor(config: PlaytimeServiceConfig) {
    super();
    this.config = {
      staleAfterMs: DEFAULT_STALE_AFTER_MS,
      watchdogIntervalMs: DEFAULT_WATCHDOG_INTERVAL_MS,
      ...config,
    };
  }

  /** Restores sessions a previous process left open in the database. Call before initialize(). */
  public hydrate(sessions: OpenSessionEntry[]): void {
    for (const row of sessions) {
      if (row.playerMinecraftUuid === NIL_UUID) continue;

      const lastSeenAt = row.lastSeenAt ?? row.sessionStart;
      this.activeSessions.set(row.playerMinecraftUuid, {
        uuid: row.playerMinecraftUuid,
        username: row.minecraftUsername,
        serverId: row.serverId,
        sessionStart: row.sessionStart,
        sessionId: row.id,
        lastSeenAt,
        creditedUntil: lastSeenAt,
        lastPlayTicks: row.lastPlayTicks ?? undefined,
        activeSeconds: row.activeSeconds,
      });
    }

    if (sessions.length > 0) {
      logger.info(
        `Restored ${this.activeSessions.size} open session(s) for server ${this.config.serverId}`,
      );
    }
  }

  /** Starts the stale-session watchdog and marks the service ready. Idempotent. */
  public initialize(): void {
    if (this.isInitialized) {
      logger.warn("PlaytimeService already initialized");
      return;
    }

    this.startedAt = new Date();
    this.watchdog = setInterval(
      () => this.runWatchdog(),
      this.config.watchdogIntervalMs,
    );
    this.watchdog.unref();

    this.isInitialized = true;
    logger.info(
      `PlaytimeService initialized for server ${this.config.serverId}`,
    );
  }

  /**
   * Sets initial server state by scanning recent relay messages for a "server
   * closed" system embed; absence is treated as ONLINE. When the relay says
   * the server is down, restored sessions are closed at their last-seen
   * instant right away instead of waiting for the watchdog. Errors fall back
   * to ONLINE so a cache lookup failure doesn't mask a live server.
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
          this.closeAllStale();
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
      this.serverState = ServerState.ONLINE;
    }
  }

  /**
   * Opens a session from a mod join payload and emits sessionStart. A
   * session already tracked for the same UUID means its leave was missed:
   * it is closed at its last-seen instant before the new one opens.
   */
  public async handlePlayerJoinFromMod(data: ModPlayerJoinData): Promise<void> {
    if (data.uuid === NIL_UUID) {
      logger.debug(
        `Ignoring join for nil UUID (fakeplayer or placeholder): ${data.username}`,
      );
      return;
    }

    const existing = this.activeSessions.get(data.uuid);
    if (existing) {
      logger.warn(
        `Player ${data.username} (${data.uuid}) joined with a session still tracked; closing the stale one at its last-seen instant`,
      );
      this.closeStaleSession(existing);
    }

    const sessionStart = data.timestamp || new Date();
    const session: ActiveSession = {
      uuid: data.uuid,
      username: data.username,
      serverId: this.config.serverId,
      sessionStart,
      lastSeenAt: sessionStart,
      creditedUntil: sessionStart,
      lastPlayTicks: data.playTimeTicks,
      activeSeconds: 0,
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
    this.markOnline();

    const event: SessionStartEvent = {
      uuid: session.uuid,
      username: session.username,
      serverId: session.serverId,
      sessionStart: session.sessionStart,
      playTimeTicks: data.playTimeTicks,
      metadata: session.metadata,
    };

    this.emit("sessionStart", event);

    logger.info(
      `Session started for ${data.username} (${data.uuid}) via mod notification`,
    );
  }

  /**
   * Ends the tracked session matching the mod leave payload, crediting the
   * slice since the last observation, and emits sessionEnd. If no session is
   * tracked (or its DB id was never set) emits an orphaned event with
   * sessionId 0 so the repository can close and credit the row itself.
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
    const reported = data.timestamp || new Date();
    const sessionEnd =
      session && reported < session.sessionStart
        ? session.sessionStart
        : reported;

    const metadata: SessionMetadata | undefined =
      data.position || data.dimension
        ? { position: data.position, dimension: data.dimension }
        : undefined;

    if (!session || !session.sessionId) {
      logger.warn(
        `Leave for ${data.username} (${data.uuid}) has no persisted session in memory; emitting orphaned sessionEnd so the repository closes the DB row`,
      );

      const event: SessionEndEvent = {
        sessionId: 0,
        uuid: data.uuid,
        username: data.username,
        serverId: this.config.serverId,
        sessionStart: session?.sessionStart ?? sessionEnd,
        sessionEnd,
        secondsPlayed: session?.activeSeconds ?? 0,
        playTimeTicks: data.playTimeTicks,
        metadata,
      };

      this.activeSessions.delete(data.uuid);
      this.emit("sessionEnd", event);
      return;
    }

    const event = this.endSession(
      session,
      sessionEnd,
      data.playTimeTicks,
      metadata,
    );

    logger.info(
      `Session ended for ${session.username} (${session.uuid}) via mod notification - ${event.secondsPlayed}s credited`,
    );
  }

  /** Relay reported the server closed: ends every tracked session now and emits serverOffline. */
  public handleServerShutdown(): void {
    if (this.activeSessions.size === 0) {
      logger.info("Server shutdown detected but no active sessions to end");
    } else {
      logger.warn(
        `Server ${this.config.serverId} shutdown detected - ending ${this.activeSessions.size} active session(s)`,
      );
      const now = new Date();
      for (const session of Array.from(this.activeSessions.values())) {
        this.endSession(session, now, undefined);
      }
    }

    this.serverState = ServerState.OFFLINE;
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

  /**
   * Reconciles tracked sessions against the heartbeat roster: credits and
   * advances present players, closes absent ones at their last-seen
   * instant, opens missing ones, and forces ONLINE state. Returns how many
   * sessions it ended and started.
   */
  public reconcileWithHeartbeat(onlinePlayers: HeartbeatPlayer[]): {
    ended: number;
    started: number;
  } {
    const now = new Date();
    const present = new Map(onlinePlayers.map((p) => [p.uuid, p]));

    let ended = 0;
    let started = 0;

    for (const session of Array.from(this.activeSessions.values())) {
      const player = present.get(session.uuid);
      if (!player) {
        logger.warn(
          `Heartbeat reconciliation: ending stale session for ${session.username} (${session.uuid})`,
        );
        this.closeStaleSession(session);
        ended++;
      } else {
        this.progressSession(session, player, now);
      }
    }

    for (const player of onlinePlayers) {
      if (player.uuid === NIL_UUID) continue;
      if (!this.activeSessions.has(player.uuid)) {
        logger.warn(
          `Heartbeat reconciliation: starting missing session for ${player.username} (${player.uuid})`,
        );
        this.startFromHeartbeat(player, now);
        started++;
      }
    }

    this.lastHeartbeatAt = now;
    this.markOnline();

    if (ended > 0 || started > 0) {
      logger.info(
        `Heartbeat reconciliation complete: ended ${ended} stale, started ${started} missing, tracking ${this.activeSessions.size} active`,
      );
    } else {
      logger.debug(
        `Heartbeat reconciliation: all ${this.activeSessions.size} sessions consistent`,
      );
    }

    return { ended, started };
  }

  private progressSession(
    session: ActiveSession,
    player: HeartbeatPlayer,
    now: Date,
  ): void {
    session.lastSeenAt = now;

    if (!session.sessionId) {
      logger.debug(
        `Heartbeat for ${session.username} (${session.uuid}) has no session row to credit against; confirming presence only`,
      );
      return;
    }

    const previousPlayTicks = session.lastPlayTicks;
    const credit = computeCredit({
      periodStart: session.creditedUntil,
      periodEnd: now,
      lastPlayTicks: previousPlayTicks,
      playTimeTicks: player.playTimeTicks,
    });

    session.creditedUntil = now;
    if (credit.playTimeTicks !== undefined) {
      session.lastPlayTicks = credit.playTimeTicks;
    }
    session.activeSeconds += credit.seconds;

    const event: SessionProgressEvent = {
      sessionId: session.sessionId,
      uuid: session.uuid,
      username: session.username,
      serverId: session.serverId,
      credit,
      previousPlayTicks,
    };

    this.emit("sessionProgress", event);
  }

  private startFromHeartbeat(player: HeartbeatPlayer, now: Date): void {
    const session: ActiveSession = {
      uuid: player.uuid,
      username: player.username,
      serverId: this.config.serverId,
      sessionStart: now,
      lastSeenAt: now,
      creditedUntil: now,
      lastPlayTicks: player.playTimeTicks,
      activeSeconds: 0,
    };

    this.activeSessions.set(player.uuid, session);

    const event: SessionStartEvent = {
      uuid: session.uuid,
      username: session.username,
      serverId: session.serverId,
      sessionStart: session.sessionStart,
      playTimeTicks: player.playTimeTicks,
    };

    this.emit("sessionStart", event);
  }

  private closeStaleSession(session: ActiveSession): void {
    const sessionEnd =
      session.lastSeenAt < session.sessionStart
        ? session.sessionStart
        : session.lastSeenAt;
    this.endSession(session, sessionEnd, undefined);
  }

  private endSession(
    session: ActiveSession,
    sessionEnd: Date,
    playTimeTicks: number | undefined,
    metadata?: SessionMetadata,
  ): SessionEndEvent {
    const credit = computeCredit({
      periodStart: session.creditedUntil,
      periodEnd: sessionEnd,
      lastPlayTicks: session.lastPlayTicks,
      playTimeTicks,
    });

    const event: SessionEndEvent = {
      sessionId: session.sessionId ?? 0,
      uuid: session.uuid,
      username: session.username,
      serverId: session.serverId,
      sessionStart: session.sessionStart,
      sessionEnd,
      secondsPlayed: session.activeSeconds + credit.seconds,
      credit,
      playTimeTicks,
      metadata,
    };

    this.activeSessions.delete(session.uuid);
    this.emit("sessionEnd", event);

    logger.debug(
      `Session ended for ${session.username} (${session.uuid}) - ${event.secondsPlayed}s credited`,
    );

    return event;
  }

  private closeAllStale(): void {
    for (const session of Array.from(this.activeSessions.values())) {
      this.closeStaleSession(session);
    }
  }

  private runWatchdog(): void {
    const now = Date.now();
    if (now - this.startedAt.getTime() < this.config.staleAfterMs) {
      return;
    }

    const cutoff = now - this.config.staleAfterMs;
    let closed = 0;

    for (const session of Array.from(this.activeSessions.values())) {
      if (session.lastSeenAt.getTime() < cutoff) {
        logger.warn(
          `Watchdog: no presence confirmation for ${session.username} (${session.uuid}) since ${session.lastSeenAt.toISOString()}, closing session`,
        );
        this.closeStaleSession(session);
        closed++;
      }
    }

    if (
      this.lastHeartbeatAt &&
      this.lastHeartbeatAt.getTime() < cutoff &&
      this.serverState === ServerState.ONLINE
    ) {
      logger.warn(
        `Watchdog: no heartbeat from server ${this.config.serverId} since ${this.lastHeartbeatAt.toISOString()}, marking OFFLINE`,
      );
      this.serverState = ServerState.OFFLINE;
      this.emit("serverOffline");
    }

    if (closed > 0) {
      logger.info(
        `Watchdog closed ${closed} stale session(s) on server ${this.config.serverId}`,
      );
    }
  }

  private markOnline(): void {
    if (this.serverState !== ServerState.ONLINE) {
      logger.info(`Server ${this.config.serverId} marked as ONLINE`);
      this.serverState = ServerState.ONLINE;
      this.emit("serverOnline");
    }
  }

  /** Attaches the DB-generated session id to the in-memory session so later events can reference it. */
  public setSessionId(uuid: string, sessionId: number): void {
    const session = this.activeSessions.get(uuid);
    if (session) {
      session.sessionId = sessionId;
      logger.debug(`Set sessionId ${sessionId} for player ${uuid}`);
    } else {
      logger.warn(`Cannot set sessionId for ${uuid} - session not found`);
    }
  }

  /** Hands a failed progress slice back so the next heartbeat re-credits it; false once the session ended or moved past it. */
  public revertProgress(event: SessionProgressEvent): boolean {
    const session = this.activeSessions.get(event.uuid);
    if (
      !session ||
      session.sessionId !== event.sessionId ||
      session.creditedUntil.getTime() !== event.credit.periodEnd.getTime()
    ) {
      return false;
    }

    session.creditedUntil = event.credit.periodStart;
    session.lastPlayTicks = event.previousPlayTicks;
    session.activeSeconds -= event.credit.seconds;
    return true;
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

  /** Wall-clock seconds elapsed in the player's current session, or null if no session is tracked. Accepts a UUID or an ActiveSession. */
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

  /** Stops the watchdog. Sessions are left open in the database on purpose: the next process restores them. */
  public stop(): void {
    logger.info("Stopping PlaytimeService...");
    if (this.watchdog) {
      clearInterval(this.watchdog);
      this.watchdog = undefined;
    }
    this.isInitialized = false;
    logger.info(
      `PlaytimeService stopped, leaving ${this.activeSessions.size} session(s) open for the next process`,
    );
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
