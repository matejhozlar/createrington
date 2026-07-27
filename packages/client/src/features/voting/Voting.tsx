import { Link } from "react-router-dom";
import { ChevronRight, Vote } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { loaderName } from "./format";

const VOTE_STATUS_STYLES: Record<string, { label: string; className: string }> =
  {
    open: {
      label: "Open",
      className: "border-green-500/50 bg-green-500/10 text-green-400",
    },
    closed: {
      label: "Closed",
      className: "border-zinc-500/50 bg-zinc-500/10 text-zinc-400",
    },
  };

export function Voting() {
  const votesQuery = trpc.user.votes.list.useQuery();

  return (
    <div className="px-5 py-10 md:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Vote className="size-5 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold">Voting</h1>
          </div>
          <p className="text-muted-foreground">
            Help shape the server by suggesting and voting on what comes next.
          </p>
        </header>

        {votesQuery.isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        )}

        {votesQuery.data?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No votes are running right now. Check back soon!
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {votesQuery.data?.map((vote) => {
            const status = VOTE_STATUS_STYLES[vote.status];
            return (
              <Link key={vote.id} to={`/voting/${vote.slug}`} className="block">
                <Card className="transition-colors hover:border-primary/40 hover:bg-accent/30">
                  <CardContent className="flex items-center gap-4 py-6">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{vote.name}</h2>
                        {status && (
                          <Badge variant="outline" className={status.className}>
                            {status.label}
                          </Badge>
                        )}
                      </div>
                      {vote.description && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {vote.description}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          {vote.gameVersion}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {loaderName(vote.modLoaderType)}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
