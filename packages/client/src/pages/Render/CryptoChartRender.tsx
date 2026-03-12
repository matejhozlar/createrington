import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  createChart,
  type IChartApi,
  type CandlestickData,
  type HistogramData,
  ColorType,
  type Time,
  CandlestickSeries,
  HistogramSeries,
} from "lightweight-charts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChartData {
  token: {
    name: string;
    symbol: string;
    category: "stable" | "blue_chip" | "memecoin" | "seasonal";
    price: string;
    totalSupply: string;
    availableSupply: string;
    circulatingSupply: string;
    marketCap: string;
    isCrashed: boolean;
    ipoEndsAt: string | null;
  };
  change24h: number;
  volume24h: string;
  activeEvent: { name: string; activeUntil: string | null } | null;
  interval: string;
  priceHistory: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

// ---------------------------------------------------------------------------
// Formatting helpers (inlined to keep render page self-contained)
// ---------------------------------------------------------------------------

function formatPrice(price: string | number): string {
  const num = Number(price);
  if (num === 0) return "$0.00";
  if (num < 0.01) return `$${num.toFixed(6)}`;
  if (num < 1) return `$${num.toFixed(4)}`;
  if (num < 1000) return `$${num.toFixed(2)}`;
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatCompact(value: string | number): string {
  const num = Number(value);
  if (num === 0) return "$0";
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
}

function formatSupplyShort(value: string | number): string {
  const num = Number(value);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

const INTERVAL_LABELS: Record<string, string> = {
  tick: "LIVE",
  minute: "1M",
  hourly: "1H",
  daily: "1D",
  weekly: "1W",
};

const CATEGORY_LABELS: Record<string, string> = {
  memecoin: "MEME",
  stable: "STABLE",
  blue_chip: "BLUE CHIP",
  seasonal: "SEASONAL",
};

// ---------------------------------------------------------------------------
// Chart component
// ---------------------------------------------------------------------------

function OHLCChart({ data }: { data: ChartData["priceHistory"] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length < 2) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 260,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#6b6b80",
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.025)" },
        horzLines: { color: "rgba(255, 255, 255, 0.025)" },
      },
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.05)",
        scaleMargins: { top: 0.08, bottom: 0.15 },
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.05)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 2,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: false,
      handleScale: false,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#f87171",
      borderUpColor: "#34d399",
      borderDownColor: "#f87171",
      wickUpColor: "#34d399",
      wickDownColor: "#f87171",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      lastValueVisible: false,
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      visible: false,
    });

    const candleData: CandlestickData<Time>[] = data.map((d) => ({
      time: d.time as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData: HistogramData<Time>[] = data.map((d) => ({
      time: d.time as Time,
      value: d.volume,
      color:
        d.close >= d.open
          ? "rgba(52, 211, 153, 0.2)"
          : "rgba(248, 113, 113, 0.2)",
    }));

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);
    chart.timeScale().fitContent();

    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [data]);

  if (data.length < 2) {
    return (
      <div className="flex h-[260px] items-center justify-center">
        <span className="text-xs text-muted-foreground/50 tracking-wider uppercase">
          Not enough data
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-[260px] w-full [&_a[href]]:!hidden" />
  );
}

// ---------------------------------------------------------------------------
// Stat pill
// ---------------------------------------------------------------------------

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-1.5 rounded bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)]">
      <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground/50">
        {label}
      </span>
      <span className="text-[13px] font-semibold text-foreground/80 tabular-nums">
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main render page
// ---------------------------------------------------------------------------

export function CryptoChartRender() {
  const [params] = useSearchParams();
  const [data, setData] = useState<ChartData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const secret = params.get("secret");
  const symbol = params.get("symbol");
  const interval = params.get("interval") ?? "minute";
  const hasMissingParams = !secret || !symbol;

  useEffect(() => {
    if (hasMissingParams) return;

    const url = new URL("/api/render/crypto-chart", window.location.origin);
    url.searchParams.set("secret", secret);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", interval);

    fetch(url.toString())
      .then((res) => {
        if (!res.ok) throw new Error("Bad response");
        return res.json() as Promise<ChartData>;
      })
      .then(setData)
      .catch(() => setFetchError("Failed to load chart data"));
  }, [hasMissingParams, secret, symbol, interval]);

  const error = hasMissingParams ? "Missing parameters" : fetchError;

  if (error) {
    return (
      <div className="w-[800px] h-[420px] bg-background flex items-center justify-center">
        <span className="text-sm tracking-wide text-destructive">{error}</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-[800px] h-[420px] bg-background flex items-center justify-center">
        <span className="text-sm tracking-wide text-muted-foreground">
          Loading...
        </span>
      </div>
    );
  }

  const { token, change24h, volume24h, activeEvent, priceHistory } = data;
  const isPositive = change24h >= 0;

  return (
    <div
      id="chart-container"
      className="relative w-[800px] h-[420px] overflow-hidden bg-background text-foreground flex flex-col"
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(oklch(1 0 0 / 0.02) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.02) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Subtle glow reflecting price direction */}
      <div
        className="absolute -top-24 -right-24 w-[300px] h-[300px] rounded-full blur-[100px] opacity-[0.08] pointer-events-none"
        style={{
          backgroundColor: isPositive ? "#34d399" : "#f87171",
        }}
      />

      {/* ── Header ── */}
      <div className="relative z-10 flex items-start justify-between px-5 pt-4 pb-1">
        {/* Left: token identity + price */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold tracking-wide text-foreground">
              {token.name}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground/60">
              {token.symbol}
            </span>
            <span className="text-[9px] font-semibold tracking-[0.12em] uppercase px-1.5 py-0.5 rounded-sm bg-[rgba(255,255,255,0.05)] text-muted-foreground/50 border border-[rgba(255,255,255,0.04)]">
              {CATEGORY_LABELS[token.category] ?? token.category}
            </span>
            {token.isCrashed && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-sm bg-destructive/15 text-destructive font-semibold border border-destructive/20">
                CRASHED
              </span>
            )}
            {activeEvent && (
              <span className="text-[9px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded-sm bg-chart-3/15 text-chart-3 border border-chart-3/20">
                {activeEvent.name}
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2.5">
            <span className="text-[28px] font-bold tabular-nums leading-none tracking-tight text-foreground">
              {formatPrice(token.price)}
            </span>
            <span
              className={`text-[13px] font-bold tabular-nums px-2 py-0.5 rounded-md ${
                isPositive
                  ? "bg-[rgba(52,211,153,0.12)] text-[#34d399]"
                  : "bg-[rgba(248,113,113,0.12)] text-[#f87171]"
              }`}
            >
              {isPositive ? "+" : ""}
              {change24h.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Right: interval badge */}
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground/40 px-2 py-1 rounded border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)]">
            {INTERVAL_LABELS[data.interval] ?? data.interval}
          </span>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="relative z-10 flex-1 px-2">
        <OHLCChart data={priceHistory} />
      </div>

      {/* ── Bottom stats ── */}
      <div className="relative z-10 flex items-center gap-2 px-5 pb-2.5 pt-0.5">
        <Stat label="Mkt Cap" value={formatCompact(token.marketCap)} />
        <Stat label="24h Vol" value={formatCompact(volume24h)} />
        <Stat
          label="Circ. Supply"
          value={formatSupplyShort(token.circulatingSupply)}
        />

        <div className="flex-1" />

        <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-foreground/10">
          create-rington.com
        </span>
      </div>
    </div>
  );
}
