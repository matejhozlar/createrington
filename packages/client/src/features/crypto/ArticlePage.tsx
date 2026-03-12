import { useParams, Link } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Loading } from "@/components/loading-spinner";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft } from "lucide-react";

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-muted-foreground/30",
  warning: "bg-primary/60",
  critical: "bg-red-400",
};

const SEVERITY_LABEL: Record<string, string> = {
  info: "Market Update",
  warning: "Market Warning",
  critical: "Critical Alert",
};

const SEVERITY_ACCENT: Record<string, string> = {
  info: "border-l-muted-foreground/30",
  warning: "border-l-primary/60",
  critical: "border-l-red-400",
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

  return (
    <div className="flex flex-1 justify-center px-4 py-8">
      <article className="w-full max-w-2xl">
        <Link
          to="/crypto"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-3" />
          Back to market
        </Link>

        <div className="flex items-center gap-2 mb-3">
          <span
            className={cn(
              "size-2 rounded-full",
              SEVERITY_DOT[event.severity] ?? SEVERITY_DOT.info,
            )}
          />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {SEVERITY_LABEL[event.severity] ?? "Market Update"}
          </span>
        </div>

        <h1 className="text-2xl font-bold leading-tight mb-3">
          {event.title}
        </h1>

        <p className="text-xs text-muted-foreground mb-4">
          Createrington Exchange &middot; {formatArticleDate(event.createdAt)}
        </p>

        <Separator className="mb-6" />

        {event.description && (
          <p className="text-sm font-medium text-muted-foreground italic mb-6 border-l-2 border-muted-foreground/20 pl-3">
            {event.description}
          </p>
        )}

        {event.article ? (
          <div
            className={cn(
              "border-l-2 pl-5 text-sm leading-7 whitespace-pre-line",
              SEVERITY_ACCENT[event.severity] ?? SEVERITY_ACCENT.info,
            )}
          >
            {event.article}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No article available for this event yet.
          </p>
        )}
      </article>
    </div>
  );
}
