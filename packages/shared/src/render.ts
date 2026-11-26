export interface RenderPlayer {
  username: string;
  uuid: string;
  tagCode: string | null;
}

export interface RenderComparePlayer extends RenderPlayer {
  networth: string;
  playtime: string;
  playtimeSeconds: number;
  sessions: number;
  memberSince: string;
}

export interface RenderCompare {
  player1: RenderComparePlayer;
  player2: RenderComparePlayer;
}

export interface RenderProfile extends RenderPlayer {
  online: boolean;
  cashBalance: string;
  playtime: string;
  playtimeSeconds: number;
  sessions: number;
  memberSince: string;
  blocksMined: number;
  mobsKilled: number;
  deaths: number;
  distanceKm: number;
}

export interface RenderActivity extends RenderPlayer {
  online: boolean;
  currentSessionSeconds: number | null;
  totalSeconds: number;
  currentStreak: number;
  mostActiveDay: string;
  days: Record<string, number>;
  today: string;
}

export interface RenderPodiumPlayer extends RenderPlayer {
  value: number;
}

export interface RenderTop {
  category: string;
  item: string;
  displayTitle: string;
  players: RenderPodiumPlayer[];
}

export interface RenderRecords {
  contestedKeys: number;
  players: RenderPodiumPlayer[];
}

export interface RenderTag {
  tagCode: string;
}

export interface RenderPayloads {
  activity: RenderActivity;
  compare: RenderCompare;
  profile: RenderProfile;
  records: RenderRecords;
  tag: RenderTag;
  top: RenderTop;
}

export type RenderPage = keyof RenderPayloads;
