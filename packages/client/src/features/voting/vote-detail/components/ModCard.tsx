import { Download, Heart, Shield, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDownloads, modCredit, MOD_STATUS_STYLES } from "../../format";

interface ModCardProps {
  mod: {
    id: number;
    status: string;
    source: string;
    submitterName: string | null;
    upvoteCount: number;
    project: {
      name: string;
      summary: string | null;
      thumbnailUrl: string | null;
      primaryAuthor: string | null;
      downloadCount: number;
    };
  };
  onClick: () => void;
  upvoted: boolean;
  canUpvote: boolean;
  onUpvote: () => void;
}

export function ModCard({
  mod,
  onClick,
  upvoted,
  canUpvote,
  onUpvote,
}: ModCardProps) {
  const status = MOD_STATUS_STYLES[mod.status];
  const credit = modCredit(mod.source, mod.submitterName);

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary/40 hover:bg-accent/30"
      onClick={onClick}
    >
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start gap-3">
          {mod.project.thumbnailUrl ? (
            <img
              src={mod.project.thumbnailUrl}
              alt=""
              className="size-12 shrink-0 rounded-lg"
              loading="lazy"
            />
          ) : (
            <div className="size-12 shrink-0 rounded-lg bg-accent" />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold">{mod.project.name}</h3>
            <p className="truncate text-xs text-muted-foreground">
              by {mod.project.primaryAuthor ?? "unknown"}
            </p>
          </div>
        </div>

        {mod.project.summary && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {mod.project.summary}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Download className="size-3" />
            {formatDownloads(mod.project.downloadCount)}
          </span>
          <button
            type="button"
            disabled={!canUpvote}
            onClick={(e) => {
              e.stopPropagation();
              onUpvote();
            }}
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors ${
              upvoted ? "text-red-400" : ""
            } ${canUpvote ? "cursor-pointer hover:bg-accent hover:text-red-400" : ""}`}
            aria-label={upvoted ? "Remove upvote" : "Upvote"}
          >
            <Heart className={`size-3 ${upvoted ? "fill-current" : ""}`} />
            {mod.upvoteCount}
          </button>
          {mod.status !== "approved" && status && (
            <Badge variant="outline" className={`text-xs ${status.className}`}>
              {status.label}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 border-t pt-2 text-xs text-muted-foreground">
          {credit.isAdmin ? (
            <Shield className="size-3 text-primary" />
          ) : (
            <User className="size-3" />
          )}
          {credit.verb}{" "}
          <span className="font-medium text-foreground">{credit.name}</span>
        </div>
      </CardContent>
    </Card>
  );
}
