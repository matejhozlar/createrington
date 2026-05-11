import type {
  AggregateStats,
  PlayerRow,
  SimulatorParams,
  SimulationResult,
  Snapshot,
  SnapshotPlayer,
} from "./types";

export const DEFAULT_PARAMS: SimulatorParams = {
  mode: "sliding",
  B: 50_000,
  cutoffDate: "2026-03-17",
  alphaEarly: 0.3,
  alphaModern: 0.4,
  alphaBase: 0.4,
  wT: 0.15,
  wP: 0.2,
  tenureCapDays: 90,
  alphaMin: 0.3,
  alphaMax: 0.5,
};

const MS_PER_DAY = 86_400_000;

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((a - b) / MS_PER_DAY);
}

function computeAlpha(
  player: SnapshotPlayer,
  params: SimulatorParams,
  maxOpSeconds: number,
): number {
  if (params.mode === "binary") {
    const alpha =
      player.joined <= params.cutoffDate
        ? params.alphaEarly
        : params.alphaModern;
    return clamp(alpha, params.alphaMin, params.alphaMax);
  }

  const opEraSeconds = Math.max(
    0,
    player.totalSeconds - player.postCutoffSeconds,
  );
  const opDays = Math.max(0, daysBetween(params.cutoffDate, player.joined));
  const tenureScore =
    params.tenureCapDays > 0 ? Math.min(1, opDays / params.tenureCapDays) : 0;
  const playScore = maxOpSeconds > 0 ? opEraSeconds / maxOpSeconds : 0;

  const alpha =
    params.alphaBase + params.wP * playScore - params.wT * tenureScore;
  return clamp(alpha, params.alphaMin, params.alphaMax);
}

export function computeNewBalance(
  player: SnapshotPlayer,
  params: SimulatorParams,
  maxOpSeconds: number,
): { newBalance: number; alpha: number } {
  const alpha = computeAlpha(player, params, maxOpSeconds);
  const newBalance =
    player.worth <= params.B
      ? player.worth
      : params.B * (player.worth / params.B) ** alpha;
  return { newBalance, alpha };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const fraction = rank - lo;
  return sorted[lo] * (1 - fraction) + sorted[hi] * fraction;
}

export function aggregateStats(values: number[]): AggregateStats {
  if (values.length === 0) {
    return {
      totalSupply: 0,
      max: 0,
      mean: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      p99: 0,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const totalSupply = sorted.reduce((acc, v) => acc + v, 0);
  return {
    totalSupply,
    max: sorted[sorted.length - 1],
    mean: totalSupply / sorted.length,
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

export function runSimulation(
  snapshot: Snapshot,
  params: SimulatorParams,
): SimulationResult {
  const maxOpSeconds = snapshot.players.reduce((acc, p) => {
    const opEra = Math.max(0, p.totalSeconds - p.postCutoffSeconds);
    return opEra > acc ? opEra : acc;
  }, 0);

  const rows: PlayerRow[] = snapshot.players.map((p) => {
    const opEraSeconds = Math.max(0, p.totalSeconds - p.postCutoffSeconds);
    const { newBalance, alpha } = computeNewBalance(p, params, maxOpSeconds);
    const percentChange =
      p.worth > 0 ? ((newBalance - p.worth) / p.worth) * 100 : 0;
    return {
      uuid: p.uuid,
      username: p.username,
      joined: p.joined,
      opEraSeconds,
      oldWorth: p.worth,
      newBalance,
      alpha,
      percentChange,
    };
  });

  const beforeStats = aggregateStats(rows.map((r) => r.oldWorth));
  const afterStats = aggregateStats(rows.map((r) => r.newBalance));

  return { rows, beforeStats, afterStats };
}
