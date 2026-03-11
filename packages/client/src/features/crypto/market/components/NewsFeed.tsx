import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ChevronRight, Newspaper } from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";
import { timeAgo } from "../../format";

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

type NewsEvent = {
  id: number;
  type: string;
  title: string;
  description: string | null;
  article: string | null;
  severity: string;
  createdAt: string;
};

export function NewsFeed() {
  const [selected, setSelected] = useState<NewsEvent | null>(null);

  const { data, isLoading } = trpc.public.crypto.newsFeed.useQuery(
    { limit: 15 },
    { refetchInterval: 30_000 },
  );

  return (
    <>
      <Card className="py-4 gap-3">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Newspaper className="size-3.5 text-muted-foreground" />
            Market Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSpinner size="small" className="py-8" />
          ) : !data?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent activity
            </p>
          ) : (
            <div className="max-h-[500px] overflow-y-auto space-y-1 pr-1">
              {data.map((event) => {
                const dotClass =
                  SEVERITY_DOT[event.severity] ?? SEVERITY_DOT.info;
                const hasArticle = !!event.article;

                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelected(event)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/10",
                      hasArticle && "cursor-pointer",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full mt-1.5 shrink-0",
                        dotClass,
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium leading-tight truncate">
                          {event.title}
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums font-mono">
                          {timeAgo(event.createdAt)}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {event.description}
                        </p>
                      )}
                    </div>
                    {hasArticle && (
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetDescription>
                  <span
                    className={cn(
                      "inline-block size-2 rounded-full mr-2 align-middle",
                      SEVERITY_DOT[selected.severity] ?? SEVERITY_DOT.info,
                    )}
                  />
                  {SEVERITY_LABEL[selected.severity] ?? "Market Update"}
                  {" · "}
                  {timeAgo(selected.createdAt)}
                </SheetDescription>
                <SheetTitle>{selected.title}</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-6">
                {selected.description && (
                  <p className="text-sm text-muted-foreground italic mb-4">
                    {selected.description}
                  </p>
                )}
                {selected.article ? (
                  <div className="text-sm leading-relaxed whitespace-pre-line">
                    {selected.article}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No article available for this event.
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
