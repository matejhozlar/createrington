import { useParams, Link } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Loading } from "@/components/loading-spinner";
import { ArrowLeft, Clock, ExternalLink, Newspaper } from "lucide-react";
import { timeAgo } from "./format";

const SEVERITY_CONFIG: Record<
  string,
  {
    label: string;
    dot: string;
    badge: string;
    accent: string;
    headerGlow: string;
  }
> = {
  info: {
    label: "Market Update",
    dot: "bg-blue-400",
    badge: "bg-blue-500/10 text-blue-400 ring-blue-500/20",
    accent: "border-l-blue-400/40",
    headerGlow: "from-blue-500/[0.03] to-transparent",
  },
  warning: {
    label: "Market Warning",
    dot: "bg-primary",
    badge: "bg-primary/10 text-primary ring-primary/20",
    accent: "border-l-primary/40",
    headerGlow: "from-primary/[0.04] to-transparent",
  },
  critical: {
    label: "Critical Alert",
    dot: "bg-red-400",
    badge: "bg-red-500/10 text-red-400 ring-red-500/20",
    accent: "border-l-red-400/40",
    headerGlow: "from-red-500/[0.05] to-transparent",
  },
};

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
        <p
          key={i}
          className="text-[15px] leading-[1.85] text-foreground/90"
        >
          {para}
        </p>
      ))}
    </div>
  );
}

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
  const tokenSymbol = (event.metadata as Record<string, unknown> | null)
    ?.targetSymbol as string | undefined;

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
          </div>
        </article>
      </div>
    </div>
  );
}
