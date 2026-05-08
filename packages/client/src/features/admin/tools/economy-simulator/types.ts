export type SnapshotPlayer = {
  uuid: string;
  username: string;
  joined: string;
  cash: number;
  crypto: number;
  worth: number;
  totalSeconds: number;
  postCutoffSeconds: number;
};

export type Snapshot = {
  generatedAt: string;
  cutoffDate: string;
  players: SnapshotPlayer[];
};

export type Mode = "binary" | "sliding";

export type SimulatorParams = {
  mode: Mode;
  B: number;
  cutoffDate: string;
  alphaEarly: number;
  alphaModern: number;
  alphaBase: number;
  wT: number;
  wP: number;
  tenureCapDays: number;
  alphaMin: number;
  alphaMax: number;
};

export type PlayerRow = {
  uuid: string;
  username: string;
  joined: string;
  opEraSeconds: number;
  oldWorth: number;
  newBalance: number;
  alpha: number;
  percentChange: number;
};

export type AggregateStats = {
  totalSupply: number;
  max: number;
  mean: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
};

export type SimulationResult = {
  rows: PlayerRow[];
  beforeStats: AggregateStats;
  afterStats: AggregateStats;
};
