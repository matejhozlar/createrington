/** A Minecraft player identified by UUID and username */
export interface MinecraftPlayer {
  uuid: string;
  username: string;
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
  /** Database session ID — set by the repository after persisting the session */
  sessionId?: number;
  metadata?: SessionMetadata;
}

/** Event emitted when a player's session ends — carries duration and DB reference */
export interface SessionEndEvent {
  sessionId: number;
  uuid: string;
  username: string;
  serverId: number;
  sessionStart: Date;
  sessionEnd: Date;
  secondsPlayed: number;
}

/** Event emitted when a player's session begins */
export interface SessionStartEvent {
  uuid: string;
  username: string;
  serverId: number;
  sessionStart: Date;
  metadata?: SessionMetadata;
}

/** Configuration for a single PlaytimeService instance */
export interface PlaytimeServiceConfig {
  serverIp: string;
  serverPort: number;
  serverId: number;
  /** Interval in ms between polling cycles (used for recovery sync) */
  pollIntervalMs?: number;
  /** Timeout in ms for server status queries */
  statusTimeoutMs?: number;
  /** Delay in ms before the first status check on startup */
  initialDelayMs?: number;
  /** Maximum number of recovery sync attempts before giving up */
  maxSyncRetries?: number;
}

/** Point-in-time snapshot of a Minecraft server's player list */
export interface ServerStatusSnapshot {
  onlinePlayers: MinecraftPlayer[];
  playerCount: number;
  maxPlayers: number;
  timestamp: Date;
}

/**
 * Player join data from PresenceAPI
 */
export interface ModPlayerJoinData {
  uuid: string;
  username: string;
  timestamp?: Date;
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
}

/** Lifecycle state of a tracked Minecraft server */
export enum ServerState {
  UNKNOWN = "unknown",
  ONLINE = "online",
  OFFLINE = "offline",
}
