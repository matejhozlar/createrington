import { useParams, Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Loading } from "@/components/loading-spinner";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Newspaper,
  TrendingUp,
  TrendingDown,
  Activity,
  Trophy,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { timeAgo, formatPrice } from "./format";
import {
  createChart,
  type IChartApi,
  ColorType,
  type Time,
  AreaSeries,
} from "lightweight-charts";

// ---------------------------------------------------------------------------
// Article data types (mirrors server JSONB shape)
// ---------------------------------------------------------------------------

interface ArticleTopHolder {
  name: string;
  amount: string;
  costBasis: string;
}

interface ArticleRecentTrade {
  name: string;
  type: string;
  amount: string;
  price: string;
  total: string;
  timeAgo: string;
}

interface ArticleLeaderboardEntry {
  rank: number;
  name: string;
  value: string;
}

interface ArticlePriceCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ArticleData {
  topHolders?: ArticleTopHolder[];
  recentTrades?: ArticleRecentTrade[];
  marketBreadth?: { up: number; down: number; flat: number };
  leaderboardTop3?: ArticleLeaderboardEntry[];
  tokenVolume24h?: string;
  totalVolume24h?: string;
  priceHistory?: ArticlePriceCandle[];
}

// ---------------------------------------------------------------------------
// Severity config
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG: Record<
  string,
  {
    label: string;
    dot: string;
    badge: string;
    accent: string;
    headerGlow: string;
    color: string;
  }
> = {
  info: {
    label: "Market Update",
    dot: "bg-blue-400",
    badge: "bg-blue-500/10 text-blue-400 ring-blue-500/20",
    accent: "border-l-blue-400/40",
    headerGlow: "from-blue-500/[0.03] to-transparent",
    color: "#60a5fa",
  },
  warning: {
    label: "Market Warning",
    dot: "bg-primary",
    badge: "bg-primary/10 text-primary ring-primary/20",
    accent: "border-l-primary/40",
    headerGlow: "from-primary/[0.04] to-transparent",
    color: "oklch(var(--primary))",
  },
  critical: {
    label: "Critical Alert",
    dot: "bg-red-400",
    badge: "bg-red-500/10 text-red-400 ring-red-500/20",
    accent: "border-l-red-400/40",
    headerGlow: "from-red-500/[0.05] to-transparent",
    color: "#f87171",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatArticleDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatVolume(vol: string): string {
  const n = Number(vol);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function parseArticleData(
  metadata: Record<string, unknown> | null,
): ArticleData | null {
  if (!metadata?.articleData) return null;
  return metadata.articleData as ArticleData;
}

// ---------------------------------------------------------------------------
// Article paragraphs
// ---------------------------------------------------------------------------

function ArticleParagraphs({ text, accent }: { text: string; accent: string }) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length <= 1) {
    return (
      <p className="text-[15px] leading-[1.85] text-foreground/90">{text}</p>
    );
  }

  const [lede, ...rest] = paragraphs;

  return (
    <div className="space-y-5">
      <p
        className={cn(
          "border-l-2 pl-4 text-[15px] leading-[1.85] font-medium text-foreground/80",
          accent,
        )}
      >
        {lede}
      </p>
      {rest.map((para, i) => (
        <p key={i} className="text-[15px] leading-[1.85] text-foreground/90">
          {para}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

function MarketStatsBar({ articleData }: { articleData: ArticleData }) {
  const stats: {
    icon: typeof Activity;
    label: string;
    value: string;
    color: string;
  }[] = [];

  if (articleData.totalVolume24h && Number(articleData.totalVolume24h) > 0) {
    stats.push({
      icon: Activity,
      label: "24h Volume",
      value: formatVolume(articleData.totalVolume24h),
      color: "text-blue-400",
    });
  }

  if (articleData.marketBreadth) {
    const { up, down } = articleData.marketBreadth;
    stats.push({
      icon: up >= down ? TrendingUp : TrendingDown,
      label: "Breadth",
      value: `${up} up / ${down} down`,
      color: up >= down ? "text-emerald-400" : "text-red-400",
    });
  }

  if (articleData.tokenVolume24h && Number(articleData.tokenVolume24h) > 0) {
    stats.push({
      icon: Wallet,
      label: "Token Vol",
      value: formatVolume(articleData.tokenVolume24h),
      color: "text-primary",
    });
  }

  if (stats.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {stats.map(({ icon: Icon, label, value, color }) => (
        <div
          key={label}
          className="flex items-center gap-2 rounded-lg border bg-card/30 px-3 py-2"
        >
          <Icon className={cn("size-3.5", color)} />
          <span className="text-[11px] text-muted-foreground">{label}</span>
          <span className="text-xs font-medium font-mono tabular-nums">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

function RecentTradesTimeline({ trades }: { trades: ArticleRecentTrade[] }) {
  if (trades.length === 0) return null;
  const display = trades.slice(0, 8);

  return (
    <div className="mt-8">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        Recent Trades
      </h3>
      <div className="space-y-1.5">
        {display.map((trade, i) => {
          const isBuy = trade.type === "buy";
          return (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border bg-card/20 px-3 py-2 text-xs"
            >
              {isBuy ? (
                <ArrowUpRight className="size-3.5 text-emerald-400 shrink-0" />
              ) : (
                <ArrowDownRight className="size-3.5 text-red-400 shrink-0" />
              )}
              <span className="font-medium truncate min-w-0">{trade.name}</span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                  isBuy
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-red-500/10 text-red-400",
                )}
              >
                {trade.type}
              </span>
              <span className="font-mono tabular-nums text-muted-foreground ml-auto shrink-0">
                {Number(trade.amount).toLocaleString()} @ $
                {formatPrice(trade.price)}
              </span>
              <span className="text-muted-foreground/60 shrink-0">
                {trade.timeAgo}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopHoldersList({ holders }: { holders: ArticleTopHolder[] }) {
  if (holders.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        Top Holders
      </h3>
      <div className="space-y-1.5">
        {holders.map((holder, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border bg-card/20 px-3 py-2 text-xs"
          >
            <span className="text-muted-foreground/60 font-mono w-4 text-right shrink-0">
              #{i + 1}
            </span>
            <span className="font-medium truncate min-w-0">{holder.name}</span>
            <span className="font-mono tabular-nums text-muted-foreground ml-auto shrink-0">
              {Number(holder.amount).toLocaleString()} tokens
            </span>
            <span className="text-muted-foreground/60 shrink-0">
              cost: ${formatPrice(holder.costBasis)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaderboardPodium({
  entries,
}: {
  entries: ArticleLeaderboardEntry[];
}) {
  if (entries.length === 0) return null;

  const RANK_COLORS = ["text-yellow-400", "text-zinc-300", "text-amber-600"];

  return (
    <div className="mt-6">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        Top Traders
      </h3>
      <div className="flex gap-2">
        {entries.map((entry, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col items-center gap-1 rounded-lg border bg-card/20 px-3 py-3"
          >
            <Trophy
              className={cn(
                "size-4",
                RANK_COLORS[i] ?? "text-muted-foreground",
              )}
            />
            <span className="text-xs font-medium truncate max-w-full">
              {entry.name}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
              $
              {Number(entry.value).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniPriceChart({
  data,
  severityColor,
}: {
  data: ArticlePriceCandle[];
  severityColor: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length < 2) return;

    const chart = createChart(containerRef.current, {
      height: 200,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a1a1aa",
        fontFamily: "ui-monospace, monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(255, 255, 255, 0.03)" },
      },
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: false,
      handleScale: false,
      crosshair: {
        vertLine: { color: "rgba(255, 255, 255, 0.1)", style: 2 },
        horzLine: { color: "rgba(255, 255, 255, 0.1)", style: 2 },
      },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: severityColor,
      topColor: severityColor + "30",
      bottomColor: severityColor + "05",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    series.setData(
      data.map((d) => ({
        time: d.time as Time,
        value: d.close,
      })),
    );

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, severityColor]);

  if (data.length < 2) return null;

  return (
    <div className="mt-6">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        Price (last 30 min)
      </h3>
      <div
        ref={containerRef}
        className="rounded-lg border bg-card/20 overflow-hidden [&_a[href]]:!hidden"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const articleId = Number(id);

  const { data: event, isLoading } = trpc.public.crypto.article.useQuery(
    { id: articleId },
    { enabled: !isNaN(articleId) },
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loading size="medium" text="Loading article..." />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">Article not found.</p>
        <Link
          to="/crypto"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" />
          Back to market
        </Link>
      </div>
    );
  }

  const severity = SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.info;
  const meta = event.metadata as Record<string, unknown> | null;
  const tokenSymbol = meta?.targetSymbol as string | undefined;
  const articleData = parseArticleData(meta);

  return (
    <div className="flex flex-1 flex-col px-5 md:px-8 pt-5 pb-16">
      <div className="max-w-3xl mx-auto w-full">
        {/* Navigation */}
        <Link
          to="/crypto"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-3" />
          Back to market
        </Link>

        {/* Article card */}
        <article className="rounded-xl border bg-card/50 overflow-hidden">
          {/* Severity glow header */}
          <div
            className={cn(
              "bg-gradient-to-b px-6 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6",
              severity.headerGlow,
            )}
          >
            {/* Badge + timestamp row */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ring-1",
                  severity.badge,
                )}
              >
                <span className={cn("size-1.5 rounded-full", severity.dot)} />
                {severity.label}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono tabular-nums">
                <Clock className="size-3" />
                {timeAgo(event.createdAt)}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-bold leading-tight tracking-tight">
              {event.title}
            </h1>

            {/* Byline */}
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <Newspaper className="size-3" />
              <span>Createrington Exchange</span>
              <span className="text-muted-foreground/30">&middot;</span>
              <span>{formatArticleDate(event.createdAt)}</span>
            </div>

            {/* Token link */}
            {tokenSymbol && (
              <Link
                to={`/crypto/${tokenSymbol}`}
                className="inline-flex items-center gap-1.5 mt-3 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
              >
                View ${tokenSymbol.toUpperCase()}
                <ExternalLink className="size-3" />
              </Link>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border/50" />

          {/* Article body */}
          <div className="px-6 py-6 sm:px-8 sm:py-8">
            {/* Market stats bar */}
            {articleData && <MarketStatsBar articleData={articleData} />}

            {event.description && (
              <p className="text-sm text-muted-foreground mb-6 italic">
                {event.description}
              </p>
            )}

            {event.article ? (
              <ArticleParagraphs
                text={event.article}
                accent={severity.accent}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No article available for this event yet.
              </p>
            )}

            {/* Data widgets below article */}
            {articleData && (
              <>
                {articleData.priceHistory &&
                  articleData.priceHistory.length >= 2 && (
                    <MiniPriceChart
                      data={articleData.priceHistory}
                      severityColor={severity.color}
                    />
                  )}

                {articleData.recentTrades &&
                  articleData.recentTrades.length > 0 && (
                    <RecentTradesTimeline trades={articleData.recentTrades} />
                  )}

                {articleData.topHolders &&
                  articleData.topHolders.length > 0 && (
                    <TopHoldersList holders={articleData.topHolders} />
                  )}

                {articleData.leaderboardTop3 &&
                  articleData.leaderboardTop3.length > 0 && (
                    <LeaderboardPodium entries={articleData.leaderboardTop3} />
                  )}
              </>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
