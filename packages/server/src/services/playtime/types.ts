/** A Minecraft player identified by UUID and username */
export interface MinecraftPlayer {
  uuid: string;
  username: string;
}

/** Heartbeat roster entry: the player plus their vanilla play_time stat when the mod reports it */
export interface HeartbeatPlayer extends MinecraftPlayer {
  playTimeTicks?: number;
}

/**
 * Session metadata collected from mod
 */
export interface SessionMetadata {
  displayName?: string;
  gamemode?: string;
  dimension?: string;
  position?: {
    x: number;
    y: number;
    z: number;
  };
  health?: number;
  experienceLevel?: number;
  ipAddress?: string;
}

/** In-memory state of a currently active player session */
export interface ActiveSession {
  uuid: string;
  username: string;
  serverId: number;
  sessionStart: Date;
  /** Database session ID: set by the repository after persisting the session */
  sessionId?: number;
  metadata?: SessionMetadata;
  /** Last instant the player was confirmed present (join, heartbeat, or the DB row on restart) */
  lastSeenAt: Date;
  /** Vanilla play_time stat at the last observation; undefined when the mod never reported it */
  lastPlayTicks?: number;
  /** Seconds already credited to the playtime tables for this session */
  activeSeconds: number;
}

/** One credited slice of a session: the wall-clock window it was observed over and the seconds it earned */
export interface PlaytimeCredit {
  periodStart: Date;
  periodEnd: Date;
  seconds: number;
  /** play_time stat observed at periodEnd, if the mod reported one */
  playTimeTicks?: number;
}

/** Event emitted when a player's session begins */
export interface SessionStartEvent {
  uuid: string;
  username: string;
  serverId: number;
  sessionStart: Date;
  playTimeTicks?: number;
  metadata?: SessionMetadata;
}

/** Event emitted on each heartbeat for a tracked player who is still present */
export interface SessionProgressEvent {
  sessionId: number;
  uuid: string;
  username: string;
  serverId: number;
  credit: PlaytimeCredit;
}

/** Event emitted when a player's session ends: carries duration and DB reference */
export interface SessionEndEvent {
  sessionId: number;
  uuid: string;
  username: string;
  serverId: number;
  sessionStart: Date;
  sessionEnd: Date;
  /** Seconds credited across the whole session, including the final credit */
  secondsPlayed: number;
  /** Final unpersisted slice; absent for orphaned ends (sessionId 0), where the repository derives it from the row */
  credit?: PlaytimeCredit;
  /** play_time stat reported with the leave event, if any */
  playTimeTicks?: number;
  metadata?: SessionMetadata;
}

/** Configuration for a single PlaytimeService instance */
export interface PlaytimeServiceConfig {
  serverId: number;
  /** Sessions with no presence confirmation for this long are closed at their last-seen instant */
  staleAfterMs?: number;
  /** How often the stale-session watchdog runs */
  watchdogIntervalMs?: number;
}

/**
 * Player join data from PresenceAPI
 */
export interface ModPlayerJoinData {
  uuid: string;
  username: string;
  timestamp?: Date;
  playTimeTicks?: number;
  displayName?: string;
  gamemode?: string;
  dimension?: string;
  position?: {
    x: number;
    y: number;
    z: number;
  };
  health?: number;
  experienceLevel?: number;
  ipAddress?: string;
}

/**
 * Player leave data from PresenceAPI
 */
export interface ModPlayerLeaveData {
  uuid: string;
  username: string;
  timestamp?: Date;
  playTimeTicks?: number;
  dimension?: string;
  position?: {
    x: number;
    y: number;
    z: number;
  };
}

/** Lifecycle state of a tracked Minecraft server */
export enum ServerState {
  UNKNOWN = "unknown",
  ONLINE = "online",
  OFFLINE = "offline",
}
