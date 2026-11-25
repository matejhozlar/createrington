export interface MinecraftPlayer {
  uuid: string;
  username: string;
}

export interface HeartbeatPlayer extends MinecraftPlayer {
  playTimeTicks?: number;
}

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

export interface ActiveSession {
  uuid: string;
  username: string;
  serverId: number;
  sessionStart: Date;
  sessionId?: number;
  metadata?: SessionMetadata;
  lastSeenAt: Date;
  creditedUntil: Date;
  lastPlayTicks?: number;
  activeSeconds: number;
  startPending?: boolean;
}

export interface PlaytimeCredit {
  periodStart: Date;
  periodEnd: Date;
  seconds: number;
  playTimeTicks?: number;
}

export interface SessionStartEvent {
  uuid: string;
  username: string;
  serverId: number;
  sessionStart: Date;
  playTimeTicks?: number;
  metadata?: SessionMetadata;
}

export interface SessionProgressEvent {
  sessionId: number;
  uuid: string;
  username: string;
  serverId: number;
  credit: PlaytimeCredit;
  previousPlayTicks: number | undefined;
}

export interface SessionEndEvent {
  sessionId: number;
  uuid: string;
  username: string;
  serverId: number;
  sessionStart: Date;
  sessionEnd: Date;
  secondsPlayed: number;
  credit?: PlaytimeCredit;
  playTimeTicks?: number;
  metadata?: SessionMetadata;
}

export interface PlaytimeServiceConfig {
  serverId: number;
  staleAfterMs?: number;
  watchdogIntervalMs?: number;
}

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

export enum ServerState {
  UNKNOWN = "unknown",
  ONLINE = "online",
  OFFLINE = "offline",
}
