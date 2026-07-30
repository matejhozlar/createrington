import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { useToastActions } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NotFound } from "@/pages/not-found";
import { loaderName } from "../format";
import { ModCard } from "./components/ModCard";
import { ModDetailDialog } from "./components/ModDetailDialog";
import { SuggestionPanel } from "./components/SuggestionPanel";

export function WorkshopDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const toast = useToastActions();
  const utils = trpc.useUtils();
  const [openModId, setOpenModId] = useState<number | null>(null);

  const workshopQuery = trpc.user.workshops.get.useQuery(
    { slug: slug! },
    { enabled: !!slug, retry: false },
  );

  const workshopId = workshopQuery.data?.workshop.id;
  const myUpvotesQuery = trpc.user.workshops.myUpvotes.useQuery(
    { workshopId: workshopId! },
    { enabled: workshopId !== undefined },
  );
  const upvotedModIds = new Set(myUpvotesQuery.data?.modIds ?? []);

  const upvoteMutation = trpc.user.workshops.upvoteMod.useMutation({
    onSuccess: () => {
      if (workshopId !== undefined) {
        utils.user.workshops.myUpvotes.invalidate({ workshopId });
      }
      utils.user.workshops.get.invalidate({ slug: slug! });
    },
    onError: (err) => toast.error(err.message),
  });

  if (workshopQuery.error?.data?.code === "NOT_FOUND") {
    return <NotFound />;
  }

  if (workshopQuery.isLoading || !workshopQuery.data) {
    return (
      <div className="px-5 py-10 md:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const { workshop, mods } = workshopQuery.data;
  const approved = mods.filter((m) => m.status === "approved");
  const pending = mods.filter((m) => m.status === "pending");
  const isOpen = workshop.status === "open";

  return (
    <div className="px-5 py-10 md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <Link
            to="/workshop"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            All workshops
          </Link>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold">{workshop.name}</h1>
              <Badge
                variant="outline"
                className={
                  isOpen
                    ? "border-green-500/50 bg-green-500/10 text-green-400"
                    : "border-zinc-500/50 bg-zinc-500/10 text-zinc-400"
                }
              >
                {isOpen ? "Open" : "Closed"}
              </Badge>
            </div>
            {workshop.description && (
              <p className="max-w-3xl text-muted-foreground">
                {workshop.description}
              </p>
            )}
            <div className="flex gap-2">
              <Badge variant="outline">{workshop.gameVersion}</Badge>
              <Badge variant="outline">
                {loaderName(workshop.modLoaderType)}
              </Badge>
            </div>
            {user && isOpen && myUpvotesQuery.data && (
              <p className="text-sm text-muted-foreground">
                You have{" "}
                <span className="font-semibold text-foreground">
                  {myUpvotesQuery.data.votesRemaining} of{" "}
                  {myUpvotesQuery.data.maxUpvotes}
                </span>{" "}
                workshops left for pending suggestions.
              </p>
            )}
          </div>
        </div>

        {user && isOpen && <SuggestionPanel workshop={workshop} />}

        <section className="space-y-4">
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold">In the pack</h2>
            <span className="text-sm text-muted-foreground">
              {approved.length} mod{approved.length !== 1 && "s"}
            </span>
          </div>
          {approved.length === 0 ? (
            <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              Nothing approved yet, be the first to suggest something!
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {approved.map((mod) => (
                <ModCard
                  key={mod.id}
                  mod={mod}
                  onClick={() => setOpenModId(mod.id)}
                  upvoted={upvotedModIds.has(mod.id)}
                  canUpvote={isOpen && mod.submittedBy !== user?.discordId}
                  onUpvote={() =>
                    upvoteMutation.mutate({ workshopModId: mod.id })
                  }
                />
              ))}
            </div>
          )}
        </section>

        {pending.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-semibold">Awaiting review</h2>
              <span className="text-sm text-muted-foreground">
                {pending.length} suggestion{pending.length !== 1 && "s"}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map((mod) => (
                <ModCard
                  key={mod.id}
                  mod={mod}
                  onClick={() => setOpenModId(mod.id)}
                  upvoted={upvotedModIds.has(mod.id)}
                  canUpvote={isOpen && mod.submittedBy !== user?.discordId}
                  onUpvote={() =>
                    upvoteMutation.mutate({ workshopModId: mod.id })
                  }
                />
              ))}
            </div>
          </section>
        )}

        <ModDetailDialog
          workshopModId={openModId}
          onOpenChange={(open) => {
            if (!open) setOpenModId(null);
          }}
        />
      </div>
    </div>
  );
}
